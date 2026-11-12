// Edge function: revierte un lote de importación eliminando los registros creados.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { hasTenantManagementRole } from "../_shared/tenant-authorization.ts";

const cors = { ...corsHeaders };

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
    const revertedBy = u.user.id;
    if (!batchId) {
      return new Response(JSON.stringify({ error: "batchId requerido" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tenantId, error: tenantError } = await supabase.rpc("get_user_tenant", { _user_id: u.user.id });
    if (tenantError || !tenantId) return new Response(JSON.stringify({ error: "Sin empresa autorizada" }), { status: 403, headers: cors });
    const { data: roles } = await supabase.from("user_roles").select("role,tenant_id").eq("user_id", u.user.id);
    const allowed = hasTenantManagementRole(roles ?? [], tenantId, true);
    if (!allowed) return new Response(JSON.stringify({ error: "Sin permiso para revertir importaciones" }), { status: 403, headers: cors });
    const { data: batch } = await admin.from("import_batches").select("*").eq("id", batchId).eq("tenant_id", tenantId).single();
    if (!batch) {
      return new Response(JSON.stringify({ error: "Lote no encontrado" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (batch.status === "reverted") {
      return new Response(JSON.stringify({ error: "Lote ya revertido" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: rows } = await admin.from("import_rows").select("*").eq("batch_id", batchId).eq("status", "imported");
    const byTable: Record<string, string[]> = {};
    for (const row of rows ?? []) {
      if (!row.target_table || !row.target_id) continue;
      const expectedTable: Record<string, string> = { contacts: "contacts", deals: "deals", activities: "activities", products: "products" };
      if (expectedTable[batch.kind] !== row.target_table) throw new Error("El lote contiene un destino de eliminación inválido");
      byTable[row.target_table] = byTable[row.target_table] ?? [];
      byTable[row.target_table].push(row.target_id);
    }

    for (const [table, ids] of Object.entries(byTable)) {
      if (ids.length === 0) continue;
      const { error } = await admin.from(table).delete().eq("tenant_id", tenantId).in("id", ids);
      if (error) throw error;
    }

    const { error: rowsError } = await admin.from("import_rows").update({ status: "pending", target_table: null, target_id: null }).eq("batch_id", batchId);
    if (rowsError) throw rowsError;
    const { error: batchError } = await admin.from("import_batches").update({ status: "reverted", reverted_at: new Date().toISOString(), reverted_by: revertedBy }).eq("id", batchId).eq("tenant_id", tenantId);
    if (batchError) throw batchError;

    return new Response(JSON.stringify({ ok: true, deleted: rows?.length ?? 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("import-revert error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Error interno" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
