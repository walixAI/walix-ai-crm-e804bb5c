// Registro central del consumo de IA: bitácora (ai_usage_log) + créditos del periodo
// (tenant_credit_balances). Siempre con rol de servicio: ai_usage_log no admite INSERT
// con la sesión del usuario, por lo que registrarlo con el cliente del usuario se pierde.
import { createClient } from "npm:@supabase/supabase-js@2";

export interface AiUsageInput {
  tenantId: string;
  userId?: string | null;
  /** Nombre visible cuando el consumo no está ligado a una cuenta (p. ej. teléfono del Copiloto). */
  actorLabel?: string | null;
  surface: "copilot" | "whatsapp" | "agent" | string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  iterations?: number;
  /** Si no se pasa, se resuelve desde ai_model_catalog. */
  creditFactor?: number;
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function periodStart() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function recordAiUsage(u: AiUsageInput) {
  try {
    const svc = serviceClient();
    const iterations = Math.max(1, u.iterations ?? 1);
    const inputTokens = u.inputTokens ?? 0;
    const outputTokens = u.outputTokens ?? 0;

    let factor = u.creditFactor;
    if (factor == null) {
      const { data } = await svc.from("ai_model_catalog")
        .select("credit_factor").eq("model_id", u.model).maybeSingle();
      factor = Number(data?.credit_factor ?? 1);
    }
    const credits = iterations * (factor || 1);

    const logPromise = svc.from("ai_usage_log").insert({
      tenant_id: u.tenantId,
      user_id: u.userId ?? null,
      actor_label: u.actorLabel ?? null,
      surface: u.surface,
      model: u.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: u.totalTokens || inputTokens + outputTokens,
      iterations,
    });

    const period = periodStart();
    const { data: bal } = await svc.from("tenant_credit_balances")
      .select("id, ai_used").eq("tenant_id", u.tenantId).eq("period_start", period).maybeSingle();

    if (bal?.id) {
      await svc.from("tenant_credit_balances")
        .update({ ai_used: Number(bal.ai_used ?? 0) + credits }).eq("id", bal.id);
    } else {
      const { data: t } = await svc.from("tenants").select("plan").eq("id", u.tenantId).maybeSingle();
      const { data: pl } = await svc.from("plan_limits")
        .select("whatsapp_credits, ai_credits").eq("plan", t?.plan ?? "pyme").maybeSingle();
      await svc.from("tenant_credit_balances").insert({
        tenant_id: u.tenantId,
        period_start: period,
        whatsapp_included: pl?.whatsapp_credits ?? 0,
        ai_included: pl?.ai_credits ?? 0,
        ai_used: credits,
      });
    }

    const { error } = await logPromise;
    if (error) console.error("[ai-usage] log", error.message);
    return credits;
  } catch (e) {
    console.error("[ai-usage] failed", e);
    return 0;
  }
}
