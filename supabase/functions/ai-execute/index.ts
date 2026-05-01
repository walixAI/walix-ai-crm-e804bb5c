import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Kind =
  | "update_deal_stage"
  | "update_deal_amount"
  | "mark_deal_won"
  | "mark_deal_lost"
  | "create_task"
  | "create_activity"
  | "update_contact"
  | "create_contact"
  | "create_deal"
  | "link_contact_to_deal"
  | "send_whatsapp_message";

interface Body {
  mode?: "preview" | "execute";
  proposal_id: string;
  kind: Kind;
  payload: Record<string, unknown>;
  summary?: string;
  prompt?: string;
}

const ACTIVITY_TYPES = ["wa_sent", "wa_received", "note", "deal", "task"];
const LEAD_STATUSES = ["Nuevo", "Contactado", "Calificado", "Propuesta", "Cerrado", "Perdido"];

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ok(target_type: string, target_id: string | null, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: true, target_type, target_id, ...extra }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function okPreview(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  return new Response(JSON.stringify({ ok: true, before, after }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return bad(401, "No autenticado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return bad(401, "No autenticado");
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? null;

    // Resolve tenant_id from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_tenant_id, tenant_id")
      .eq("id", userId)
      .maybeSingle();
    const tenantId = (profile?.active_tenant_id ?? profile?.tenant_id) as string | undefined;
    if (!tenantId) return bad(400, "Sin tenant activo");

    const body = (await req.json()) as Body;
    if (!body?.kind || !body?.payload) return bad(400, "Cuerpo inválido");
    const p = body.payload as any;
    const mode = body.mode ?? "execute";

    // ─── PREVIEW MODE: read current state, compute diff, do NOT write ───
    if (mode === "preview") {
      switch (body.kind) {
        case "update_deal_stage": {
          if (!isUuid(p.deal_id) || !isUuid(p.stage_id)) return bad(400, "deal_id/stage_id inválido");
          const [{ data: deal }, { data: stage }] = await Promise.all([
            supabase.from("deals").select("id, name, stage_name, probability").eq("id", p.deal_id).maybeSingle(),
            supabase.from("pipeline_stages").select("id, name, is_won, is_lost").eq("id", p.stage_id).maybeSingle(),
          ]);
          if (!deal) return bad(404, "Deal no encontrado");
          if (!stage) return bad(404, "Etapa no encontrada");
          const after: Record<string, unknown> = { Etapa: stage.name };
          if (stage.is_won) after["Probabilidad"] = 100;
          if (stage.is_lost) after["Probabilidad"] = 0;
          const before: Record<string, unknown> = { Etapa: deal.stage_name ?? "—" };
          if ("Probabilidad" in after) before["Probabilidad"] = `${deal.probability ?? 0}%`;
          if ("Probabilidad" in after) after["Probabilidad"] = `${after["Probabilidad"]}%`;
          return okPreview(before, after);
        }
        case "update_deal_amount": {
          if (!isUuid(p.deal_id)) return bad(400, "deal_id inválido");
          const { data: deal } = await supabase.from("deals").select("amount, probability").eq("id", p.deal_id).maybeSingle();
          if (!deal) return bad(404, "Deal no encontrado");
          const before: Record<string, unknown> = {};
          const after: Record<string, unknown> = {};
          if (typeof p.amount === "number") {
            before["Monto"] = `$${Number(deal.amount ?? 0).toLocaleString("es-MX")}`;
            after["Monto"] = `$${p.amount.toLocaleString("es-MX")}`;
          }
          if (typeof p.probability === "number") {
            before["Probabilidad"] = `${deal.probability ?? 0}%`;
            after["Probabilidad"] = `${Math.round(p.probability)}%`;
          }
          return okPreview(before, after);
        }
        case "mark_deal_won": {
          if (!isUuid(p.deal_id)) return bad(400, "deal_id inválido");
          const { data: deal } = await supabase.from("deals").select("stage_name, probability, is_won, is_lost").eq("id", p.deal_id).maybeSingle();
          if (!deal) return bad(404, "Deal no encontrado");
          return okPreview(
            { Estado: deal.is_won ? "Ganado" : deal.is_lost ? "Perdido" : "Abierto", Probabilidad: `${deal.probability ?? 0}%` },
            { Estado: "Ganado", Probabilidad: "100%" },
          );
        }
        case "mark_deal_lost": {
          if (!isUuid(p.deal_id)) return bad(400, "deal_id inválido");
          if (typeof p.lost_reason !== "string" || !p.lost_reason.trim()) {
            return bad(400, "Falta motivo de pérdida — edita la propuesta");
          }
          const { data: deal } = await supabase.from("deals").select("stage_name, is_won, is_lost").eq("id", p.deal_id).maybeSingle();
          if (!deal) return bad(404, "Deal no encontrado");
          const after: Record<string, unknown> = { Estado: "Perdido", Probabilidad: "0%" };
          if (typeof p.lost_reason === "string") after["Motivo"] = p.lost_reason;
          if (typeof p.lost_comment === "string" && p.lost_comment.trim()) after["Comentario"] = p.lost_comment;
          return okPreview(
            { Estado: deal.is_won ? "Ganado" : deal.is_lost ? "Perdido" : "Abierto" },
            after,
          );
        }
        case "create_task": {
          const after: Record<string, unknown> = { Título: p.title ?? "—" };
          if (typeof p.due_at === "string") after["Vence"] = p.due_at;
          return okPreview(null, after);
        }
        case "create_activity": {
          return okPreview(null, { Tipo: p.type ?? "note", Descripción: p.description ?? "—" });
        }
        case "update_contact": {
          if (!isUuid(p.contact_id)) return bad(400, "contact_id inválido");
          const { data: contact } = await supabase.from("contacts")
            .select("name, last_name, email, phone, company, position, status, tags")
            .eq("id", p.contact_id).maybeSingle();
          if (!contact) return bad(404, "Contacto no encontrado");
          const fields = ["name", "last_name", "email", "phone", "company", "position", "status"] as const;
          const labels: Record<string, string> = {
            name: "Nombre", last_name: "Apellido", email: "Email", phone: "Teléfono",
            company: "Empresa", position: "Puesto", status: "Estado",
          };
          const before: Record<string, unknown> = {};
          const after: Record<string, unknown> = {};
          for (const f of fields) {
            if (typeof p[f] === "string" && p[f] !== (contact as any)[f]) {
              before[labels[f]] = (contact as any)[f] ?? "—";
              after[labels[f]] = p[f];
            }
          }
          if (Array.isArray(p.tags)) {
            const cur = (contact.tags ?? []).join(", ") || "—";
            const next = p.tags.join(", ") || "—";
            if (cur !== next) { before["Tags"] = cur; after["Tags"] = next; }
          }
          return okPreview(before, after);
        }
        case "create_contact": {
          const after: Record<string, unknown> = {};
          for (const f of ["name", "last_name", "phone", "email", "company", "position", "status"]) {
            if (typeof p[f] === "string" && p[f]) after[f === "name" ? "Nombre" : f === "last_name" ? "Apellido" : f === "phone" ? "Teléfono" : f === "email" ? "Email" : f === "company" ? "Empresa" : f === "position" ? "Puesto" : "Estado"] = p[f];
          }
          return okPreview(null, after);
        }
        case "create_deal": {
          const after: Record<string, unknown> = {
            Nombre: p.name ?? "—",
            Monto: typeof p.amount === "number" ? `$${p.amount.toLocaleString("es-MX")}` : "—",
          };
          if (typeof p.contact_name === "string" && p.contact_name) after["Contacto"] = p.contact_name;
          else if (isUuid(p.contact_id)) {
            const { data: c } = await supabase.from("contacts").select("name, last_name").eq("id", p.contact_id).maybeSingle();
            if (c) after["Contacto"] = `${c.name}${c.last_name ? " " + c.last_name : ""}`;
          }
          if (isUuid(p.stage_id)) {
            const { data: st } = await supabase.from("pipeline_stages").select("name").eq("id", p.stage_id).maybeSingle();
            if (st) after["Etapa"] = st.name;
          } else {
            const { data: firstStage } = await supabase.from("pipeline_stages")
              .select("name").order("position", { ascending: true }).limit(1).maybeSingle();
            if (firstStage) after["Etapa"] = `${firstStage.name} (default)`;
          }
          if (typeof p.probability === "number") after["Probabilidad"] = `${Math.round(p.probability)}%`;
          if (typeof p.expected_close_date === "string") after["Cierre esperado"] = p.expected_close_date;
          return okPreview(null, after);
        }
        case "link_contact_to_deal": {
          if (!isUuid(p.deal_id)) return bad(400, "deal_id inválido");
          if (!isUuid(p.contact_id)) return bad(400, "contact_id inválido");
          const [{ data: deal }, { data: newContact }] = await Promise.all([
            supabase.from("deals").select("name, contact_id").eq("id", p.deal_id).maybeSingle(),
            supabase.from("contacts").select("name, last_name, company").eq("id", p.contact_id).maybeSingle(),
          ]);
          if (!deal) return bad(404, "Deal no encontrado");
          if (!newContact) return bad(404, "Contacto no encontrado");
          let beforeLabel = "—";
          if (isUuid(deal.contact_id)) {
            const { data: cur } = await supabase.from("contacts")
              .select("name, last_name").eq("id", deal.contact_id).maybeSingle();
            if (cur) beforeLabel = `${cur.name}${cur.last_name ? " " + cur.last_name : ""}`;
          }
          const afterLabel = `${newContact.name}${newContact.last_name ? " " + newContact.last_name : ""}${newContact.company ? ` (${newContact.company})` : ""}`;
          return okPreview({ Contacto: beforeLabel }, { Contacto: afterLabel });
        }
        case "send_whatsapp_message": {
          if (!isUuid(p.conversation_id)) return bad(400, "conversation_id inválido");
          const body = typeof p.body === "string" ? p.body.trim() : "";
          if (!body) return bad(400, "body vacío");
          if (body.length > 1000) return bad(400, "body demasiado largo (máx 1000)");
          const { data: cv } = await supabase.from("conversations")
            .select("id, status, preview, contact_id").eq("id", p.conversation_id).maybeSingle();
          if (!cv) return bad(404, "Conversación no encontrada");
          let toLabel = "—";
          if (isUuid(cv.contact_id)) {
            const { data: c } = await supabase.from("contacts")
              .select("name, last_name").eq("id", cv.contact_id).maybeSingle();
            if (c) toLabel = `${c.name}${c.last_name ? " " + c.last_name : ""}`;
          }
          return okPreview(
            { "Último mensaje": (cv.preview ?? "—").slice(0, 80) || "—" },
            { "Para": toLabel, "Mensaje saliente": body },
          );
        }
        default:
          return bad(400, `kind no soportado: ${body.kind}`);
      }
    }

    let target_type = "";
    let target_id: string | null = null;
    let result: Record<string, unknown> = {};

    switch (body.kind) {
      case "update_deal_stage": {
        if (!isUuid(p.deal_id) || !isUuid(p.stage_id)) return bad(400, "deal_id/stage_id inválido");
        const { data: stage, error: sErr } = await supabase
          .from("pipeline_stages")
          .select("id, name, is_won, is_lost")
          .eq("id", p.stage_id)
          .maybeSingle();
        if (sErr || !stage) return bad(404, "Etapa no encontrada");
        const upd: any = { stage_id: stage.id, stage_name: stage.name, is_won: !!stage.is_won, is_lost: !!stage.is_lost };
        const { data, error } = await supabase.from("deals").update(upd).eq("id", p.deal_id).select("id").maybeSingle();
        if (error) return bad(400, error.message);
        target_type = "deal"; target_id = data?.id ?? p.deal_id;
        result = { stage_name: stage.name };
        break;
      }
      case "update_deal_amount": {
        if (!isUuid(p.deal_id)) return bad(400, "deal_id inválido");
        const upd: any = {};
        if (typeof p.amount === "number" && p.amount >= 0) upd.amount = p.amount;
        if (typeof p.probability === "number" && p.probability >= 0 && p.probability <= 100) upd.probability = Math.round(p.probability);
        if (!Object.keys(upd).length) return bad(400, "Nada para actualizar");
        const { data, error } = await supabase.from("deals").update(upd).eq("id", p.deal_id).select("id").maybeSingle();
        if (error) return bad(400, error.message);
        target_type = "deal"; target_id = data?.id ?? p.deal_id;
        break;
      }
      case "mark_deal_won": {
        if (!isUuid(p.deal_id)) return bad(400, "deal_id inválido");
        const { data, error } = await supabase.from("deals")
          .update({ is_won: true, is_lost: false, probability: 100 })
          .eq("id", p.deal_id).select("id").maybeSingle();
        if (error) return bad(400, error.message);
        target_type = "deal"; target_id = data?.id ?? p.deal_id;
        break;
      }
      case "mark_deal_lost": {
        if (!isUuid(p.deal_id)) return bad(400, "deal_id inválido");
        const reason = typeof p.lost_reason === "string" ? p.lost_reason : null;
        if (!reason) return bad(400, "lost_reason requerido");
        const upd: any = { is_lost: true, is_won: false, probability: 0, lost_reason: reason };
        if (typeof p.lost_comment === "string") upd.lost_comment = p.lost_comment;
        const { data, error } = await supabase.from("deals").update(upd).eq("id", p.deal_id).select("id").maybeSingle();
        if (error) return bad(400, error.message);
        target_type = "deal"; target_id = data?.id ?? p.deal_id;
        break;
      }
      case "create_task": {
        if (typeof p.title !== "string" || !p.title.trim()) return bad(400, "title requerido");
        const ins: any = { tenant_id: tenantId, title: p.title.trim() };
        if (typeof p.due_at === "string") ins.due_at = p.due_at;
        if (isUuid(p.deal_id)) ins.deal_id = p.deal_id;
        if (isUuid(p.contact_id)) ins.contact_id = p.contact_id;
        if (isUuid(p.assignee_id)) ins.assignee_id = p.assignee_id;
        const { data, error } = await supabase.from("tasks").insert(ins).select("id").maybeSingle();
        if (error) return bad(400, error.message);
        target_type = "task"; target_id = data?.id ?? null;
        break;
      }
      case "create_activity": {
        const t = String(p.type ?? "note");
        if (!ACTIVITY_TYPES.includes(t)) return bad(400, "type inválido");
        if (typeof p.description !== "string" || !p.description.trim()) return bad(400, "description requerido");
        const ins: any = { tenant_id: tenantId, type: t, description: p.description.trim() };
        if (isUuid(p.deal_id)) ins.deal_id = p.deal_id;
        if (isUuid(p.contact_id)) ins.contact_id = p.contact_id;
        const { data, error } = await supabase.from("activities").insert(ins).select("id").maybeSingle();
        if (error) return bad(400, error.message);
        target_type = "activity"; target_id = data?.id ?? null;
        break;
      }
      case "update_contact": {
        if (!isUuid(p.contact_id)) return bad(400, "contact_id inválido");
        const upd: any = {};
        for (const k of ["name", "last_name", "email", "phone", "company", "position"]) {
          if (typeof p[k] === "string") upd[k] = p[k];
        }
        if (typeof p.status === "string" && LEAD_STATUSES.includes(p.status)) upd.status = p.status;
        if (Array.isArray(p.tags) && p.tags.every((x: unknown) => typeof x === "string")) upd.tags = p.tags;
        if (!Object.keys(upd).length) return bad(400, "Nada para actualizar");
        const { data, error } = await supabase.from("contacts").update(upd).eq("id", p.contact_id).select("id").maybeSingle();
        if (error) return bad(400, error.message);
        target_type = "contact"; target_id = data?.id ?? p.contact_id;
        break;
      }
      case "create_contact": {
        if (typeof p.name !== "string" || !p.name.trim()) return bad(400, "name requerido");
        if (typeof p.phone !== "string" || !p.phone.trim()) return bad(400, "phone requerido");
        const ins: any = { tenant_id: tenantId, name: p.name.trim(), phone: p.phone.trim() };
        for (const k of ["last_name", "email", "company", "position"]) {
          if (typeof p[k] === "string") ins[k] = p[k];
        }
        if (typeof p.status === "string" && LEAD_STATUSES.includes(p.status)) ins.status = p.status;
        const { data, error } = await supabase.from("contacts").insert(ins).select("id").maybeSingle();
        if (error) return bad(400, error.message);
        target_type = "contact"; target_id = data?.id ?? null;
        break;
      }
      case "create_deal": {
        if (typeof p.name !== "string" || !p.name.trim()) return bad(400, "name requerido");
        if (typeof p.amount !== "number" || p.amount <= 0) return bad(400, "amount debe ser > 0");
        let stageId: string | null = isUuid(p.stage_id) ? p.stage_id : null;
        let stageName: string | null = null;
        let stageProb = 10;
        if (!stageId) {
          const { data: firstStage } = await supabase.from("pipeline_stages")
            .select("id, name, is_won, is_lost").eq("tenant_id", tenantId)
            .order("position", { ascending: true }).limit(1).maybeSingle();
          if (firstStage) {
            stageId = firstStage.id;
            stageName = firstStage.name;
            stageProb = firstStage.is_won ? 100 : firstStage.is_lost ? 0 : 10;
          }
        } else {
          const { data: st } = await supabase.from("pipeline_stages").select("name, is_won, is_lost").eq("id", stageId).maybeSingle();
          stageName = st?.name ?? null;
          if (st) stageProb = st.is_won ? 100 : st.is_lost ? 0 : 10;
        }
        const ins: any = {
          tenant_id: tenantId,
          name: p.name.trim(),
          amount: p.amount,
          probability: typeof p.probability === "number" ? Math.max(0, Math.min(100, Math.round(p.probability))) : stageProb,
        };
        if (stageId) ins.stage_id = stageId;
        if (stageName) ins.stage_name = stageName;
        if (isUuid(p.contact_id)) ins.contact_id = p.contact_id;
        if (typeof p.expected_close_date === "string" && p.expected_close_date) ins.expected_close_date = p.expected_close_date;
        const { data, error } = await supabase.from("deals").insert(ins).select("id").maybeSingle();
        if (error) return bad(400, error.message);
        target_type = "deal"; target_id = data?.id ?? null;
        break;
      }
      case "link_contact_to_deal": {
        if (!isUuid(p.deal_id)) return bad(400, "deal_id inválido");
        if (!isUuid(p.contact_id)) return bad(400, "contact_id inválido");
        const { data, error } = await supabase.from("deals")
          .update({ contact_id: p.contact_id })
          .eq("id", p.deal_id).select("id").maybeSingle();
        if (error) return bad(400, error.message);
        target_type = "deal"; target_id = data?.id ?? p.deal_id;
        break;
      }
      default:
        return bad(400, `kind no soportado: ${body.kind}`);
    }

    // Audit log (RLS allows actor_id = auth.uid())
    await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      actor_id: userId,
      actor_email: userEmail,
      action: `ai_execute_${body.kind}`,
      target_type,
      target_id,
      metadata: {
        proposal_id: body.proposal_id,
        summary: body.summary ?? null,
        prompt: body.prompt ?? null,
        payload: body.payload,
        ai_model: "google/gemini-2.5-flash",
      },
    });

    return ok(target_type, target_id, result);
  } catch (e) {
    console.error("ai-execute error:", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});