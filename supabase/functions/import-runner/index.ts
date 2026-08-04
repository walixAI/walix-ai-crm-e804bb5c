// Edge function: ejecuta la importación confirmada por el usuario.
// Valida fila por fila, normaliza teléfonos, detecta duplicados e inserta.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const cors = { ...corsHeaders };

function normalizePhone(raw: any): string | null {
  if (raw == null) return null;
  let s = String(raw).replace(/\D/g, "");
  if (s.length === 10) s = "52" + s;
  if (s.length === 12 && s.startsWith("52")) return s;
  if (s.length === 11 && s.startsWith("521")) return "52" + s.slice(3);
  if (s.length === 13 && s.startsWith("521")) return "52" + s.slice(3);
  return s.length >= 10 ? s : null;
}

function parseDate(raw: any): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseAmount(raw: any): number | null {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/[$,]/g, ""));
  return isNaN(n) ? null : n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const batchId = String(body?.batchId ?? "");
    const mappings: Record<string, string> = body?.mappings ?? {};
    if (!batchId) {
      return new Response(JSON.stringify({ error: "batchId requerido" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: batch, error: batchErr } = await admin
      .from("import_batches")
      .select("*, tenants:tenant_id(organization_id)")
      .eq("id", batchId)
      .single();
    if (batchErr || !batch) {
      return new Response(JSON.stringify({ error: "Lote no encontrado" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: rows } = await admin
      .from("import_rows")
      .select("*")
      .eq("batch_id", batchId)
      .eq("status", "pending");

    const tenantId = batch.tenant_id;
    const orgId = batch.tenants?.organization_id;

    let imported = 0;
    let errors = 0;
    let skipped = 0;

    const contactCache = new Map<string, any>();

    for (const row of rows ?? []) {
      const raw = row.raw_data as Record<string, any>;
      const mapped: Record<string, any> = {};
      for (const [field, header] of Object.entries(mappings)) {
        mapped[field] = raw[header];
      }

      try {
        if (batch.kind === "contacts") {
          const phone = normalizePhone(mapped.phone);
          if (!phone) {
            throw new Error("Teléfono inválido");
          }
          const e164 = "+" + phone;

          const { data: existing } = await admin
            .from("contacts")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("phone", e164)
            .maybeSingle();

          if (existing) {
            await admin.from("import_rows").update({ status: "skipped", error_message: "Contacto duplicado" }).eq("id", row.id);
            skipped++;
            continue;
          }

          const status = ["prospecto", "cliente", "cliente_inactivo", "inactivo"].includes(String(mapped.lifecycle ?? mapped.status).toLowerCase())
            ? String(mapped.lifecycle ?? mapped.status).toLowerCase()
            : "prospecto";

          const { data: contact, error: insertErr } = await admin.from("contacts").insert({
            tenant_id: tenantId,
            name: mapped.name || mapped.full_name || "Sin nombre",
            last_name: mapped.last_name || null,
            phone: e164,
            phone_alt: normalizePhone(mapped.phone_alt) ? "+" + normalizePhone(mapped.phone_alt) : null,
            email: mapped.email || null,
            company: mapped.company || null,
            address: mapped.address || null,
            source: mapped.source || "Manual",
            status,
          }).select("id").single();

          if (insertErr) throw insertErr;

          if (mapped.owner_email) {
            const { data: owner } = await admin.from("profiles").select("id").eq("email", mapped.owner_email).maybeSingle();
            if (owner) {
              await admin.from("contacts").update({ owner_id: owner.id }).eq("id", contact.id);
            }
          }

          contactCache.set(e164, contact);
          await admin.from("import_rows").update({ status: "imported", target_table: "contacts", target_id: contact.id, mapped_data: mapped }).eq("id", row.id);
          imported++;
        } else if (batch.kind === "deals") {
          const phone = normalizePhone(mapped.contact_phone);
          if (!phone) throw new Error("Teléfono de contacto inválido");
          const e164 = "+" + phone;

          let contact = contactCache.get(e164);
          if (!contact) {
            const { data: c } = await admin.from("contacts").select("id, owner_id").eq("tenant_id", tenantId).eq("phone", e164).maybeSingle();
            contact = c;
          }
          if (!contact) {
            throw new Error("Contacto no encontrado");
          }

          let stageId: string | null = null;
          let stageName: string | null = null;
          if (mapped.stage_name) {
            const { data: stage } = await admin.from("pipeline_stages").select("id, name, pipeline_id").eq("tenant_id", tenantId).ilike("name", mapped.stage_name).maybeSingle();
            if (stage) { stageId = stage.id; stageName = stage.name; }
          }
          if (!stageId) throw new Error("Etapa no encontrada: " + (mapped.stage_name ?? "(vacía)"));

          const { data: deal, error: dealErr } = await admin.from("deals").insert({
            tenant_id: tenantId,
            contact_id: contact.id,
            name: mapped.name || mapped.title || "Oportunidad importada",
            amount: parseAmount(mapped.amount),
            stage_id: stageId,
            stage_name: stageName,
            owner_id: contact.owner_id,
            expected_close_date: parseDate(mapped.close_date)?.slice(0, 10),
            source: mapped.source || "Manual",
          }).select("id").single();

          if (dealErr) throw dealErr;
          await admin.from("import_rows").update({ status: "imported", target_table: "deals", target_id: deal.id, mapped_data: mapped }).eq("id", row.id);
          imported++;
        } else if (batch.kind === "activities") {
          const phone = normalizePhone(mapped.contact_phone);
          if (!phone) throw new Error("Teléfono de contacto inválido");
          const e164 = "+" + phone;

          let contact = contactCache.get(e164);
          if (!contact) {
            const { data: c } = await admin.from("contacts").select("id, owner_id").eq("tenant_id", tenantId).eq("phone", e164).maybeSingle();
            contact = c;
          }
          if (!contact) {
            throw new Error("Contacto no encontrado");
          }

          const type = ["wa_sent", "wa_received", "note", "deal", "task", "call", "meeting", "email", "manual"].includes(String(mapped.type).toLowerCase())
            ? String(mapped.type).toLowerCase()
            : "note";
          const direction = ["inbound", "outbound"].includes(String(mapped.direction).toLowerCase())
            ? String(mapped.direction).toLowerCase()
            : "outbound";

          const { data: activity, error: actErr } = await admin.from("activities").insert({
            tenant_id: tenantId,
            contact_id: contact.id,
            type,
            description: mapped.description || mapped.notes || "Actividad importada",
            occurred_at: parseDate(mapped.occurred_at ?? mapped.performed_at) || new Date().toISOString(),
            metadata: { direction, imported: true },
          }).select("id").single();

          if (actErr) throw actErr;
          await admin.from("import_rows").update({ status: "imported", target_table: "activities", target_id: activity.id, mapped_data: mapped }).eq("id", row.id);
          imported++;
        } else if (batch.kind === "products") {
          const { data: product, error: prodErr } = await admin.from("products").insert({
            tenant_id: tenantId,
            name: mapped.name || "Producto importado",
            sku: mapped.sku || null,
            price: parseAmount(mapped.price),
            category: mapped.category || null,
            created_by: u.user.id,
          }).select("id").single();

          if (prodErr) throw prodErr;
          await admin.from("import_rows").update({ status: "imported", target_table: "products", target_id: product.id, mapped_data: mapped }).eq("id", row.id);
          imported++;
        } else {
          throw new Error("Tipo de importe no soportado");
        }
      } catch (e: any) {
        await admin.from("import_rows").update({ status: "error", error_message: e?.message ?? "Error desconocido", mapped_data: mapped }).eq("id", row.id);
        errors++;
      }
    }

    await admin.from("import_batches").update({
      status: "done",
      imported_rows: imported,
      error_rows: errors,
      skipped_rows: skipped,
    }).eq("id", batchId);

    return new Response(JSON.stringify({ ok: true, imported, errors, skipped }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("import-runner error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Error interno" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
