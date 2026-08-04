// Resolución del motor de IA asignado a cada tenant (lo define el dueño de la plataforma).
// Por defecto todos los tenants usan el motor más económico.

export const DEFAULT_MODEL = "google/gemini-3.1-flash-lite";
export const DEFAULT_VENDOR = "gemini";

export interface TenantModel {
  vendor: string;
  model: string;
  creditFactor: number;
}

export async function resolveTenantModel(sb: any, tenantId: string): Promise<TenantModel> {
  const fallback: TenantModel = { vendor: DEFAULT_VENDOR, model: DEFAULT_MODEL, creditFactor: 1 };
  try {
    const { data: t } = await sb
      .from("tenants")
      .select("ai_vendor, ai_model")
      .eq("id", tenantId)
      .maybeSingle();
    const model = t?.ai_model || DEFAULT_MODEL;
    const vendor = t?.ai_vendor || DEFAULT_VENDOR;
    const { data: c } = await sb
      .from("ai_model_catalog")
      .select("credit_factor")
      .eq("model_id", model)
      .maybeSingle();
    return { vendor, model, creditFactor: Number(c?.credit_factor ?? 1) };
  } catch (_e) {
    return fallback;
  }
}

/** Créditos consumidos por una interacción (1 acción base x factor del motor). */
export function creditsForRun(iterations: number, factor: number) {
  return Math.max(1, iterations) * (factor || 1);
}
