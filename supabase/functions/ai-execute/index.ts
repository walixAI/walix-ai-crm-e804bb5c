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
  | "create_contact";

interface Body {
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