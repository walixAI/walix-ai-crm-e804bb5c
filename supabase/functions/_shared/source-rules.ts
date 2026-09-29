// Fuentes de ingreso de leads permitidas por empresa (dominios, formularios Meta, cuentas publicitarias).
// Si una empresa definió reglas de un tipo, solo se aceptan leads que coincidan con ellas.

export type RuleKind = "web_domain" | "meta_form" | "meta_ad_account" | "google_ads_account";

export function normalizeRuleValue(kind: RuleKind, v: string): string {
  let s = String(v ?? "").trim().toLowerCase();
  if (kind === "web_domain") {
    s = s.replace(/^https?:\/\//, "").split("/")[0].split(":")[0].replace(/^www\./, "");
  } else if (kind === "meta_ad_account") {
    s = s.replace(/^act_/, "").replace(/\D/g, "");
  } else if (kind === "google_ads_account") {
    s = s.replace(/\D/g, "");
  } else {
    s = s.replace(/\D/g, "") || s;
  }
  return s;
}

export function domainFrom(url?: string | null): string | null {
  if (!url) return null;
  try { return normalizeRuleValue("web_domain", new URL(url).hostname); } catch { return null; }
}

const domainMatches = (rule: string, host: string) => host === rule || host.endsWith("." + rule);

/** Empresa dueña de un formulario de Meta según las reglas. */
export async function tenantForMetaForm(sb: any, formId: string): Promise<string | null> {
  const { data } = await sb.from("lead_source_rules").select("tenant_id")
    .eq("kind", "meta_form").eq("value", normalizeRuleValue("meta_form", formId)).eq("is_active", true).maybeSingle();
  return data?.tenant_id ?? null;
}

export interface SourceCheckInput {
  domain?: string | null;
  metaFormId?: string | null;
  metaAdAccount?: string | null;
  googleAdsAccount?: string | null;
}

/** Valida el lead contra las reglas de la empresa. Devuelve el motivo si se rechaza. */
export async function checkLeadSource(sb: any, tenantId: string, input: SourceCheckInput): Promise<{ ok: boolean; reason?: string; kind?: RuleKind; value?: string }> {
  const { data: rules } = await sb.from("lead_source_rules").select("id, kind, value, leads_count")
    .eq("tenant_id", tenantId).eq("is_active", true);
  const list = (rules ?? []) as { id: string; kind: RuleKind; value: string; leads_count: number }[];
  const matched: string[] = [];
  let failKind: RuleKind | undefined; let failValue: string | undefined;

  const check = (kind: RuleKind, raw: string | null | undefined, label: string) => {
    const ofKind = list.filter((r) => r.kind === kind);
    if (!ofKind.length) return null; // sin reglas de este tipo: se acepta
    if (!raw) return null; // el lead no trae este dato: no aplica
    const v = normalizeRuleValue(kind, raw);
    const hit = ofKind.find((r) => (kind === "web_domain" ? domainMatches(r.value, v) : r.value === v));
    if (!hit) { failKind = kind; failValue = v; return `${label} no autorizado: ${v}`; }
    matched.push(hit.id);
    return null;
  };

  const reason =
    check("web_domain", input.domain, "Dominio") ??
    check("meta_form", input.metaFormId, "Formulario de Meta") ??
    check("meta_ad_account", input.metaAdAccount, "Cuenta publicitaria de Meta") ??
    check("google_ads_account", input.googleAdsAccount, "Cuenta de Google Ads");
  if (reason) return { ok: false, reason, kind: failKind, value: failValue };

  const now = new Date().toISOString();
  for (const id of matched) {
    const r = list.find((x) => x.id === id)!;
    await sb.from("lead_source_rules").update({ leads_count: (r.leads_count ?? 0) + 1, last_lead_at: now }).eq("id", id);
  }
  return { ok: true };
}
