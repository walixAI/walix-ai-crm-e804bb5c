/** Etiquetas homologadas de planes (empresa y organización). */
export const TENANT_PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pyme: "PyME",
  growth: "Growth",
  enterprise: "Enterprise",
};

export const ORG_PLAN_LABEL: Record<string, string> = {
  org_starter: "Starter",
  org_pyme: "PyME",
  org_growth: "Growth",
  org_enterprise: "Enterprise",
};

export const tenantPlanLabel = (plan?: string | null) =>
  (plan && TENANT_PLAN_LABEL[plan]) || plan || "—";

export const orgPlanLabel = (plan?: string | null) =>
  (plan && ORG_PLAN_LABEL[plan]) || plan || "—";

/** Los límites "ilimitados" se guardan como 9999 en la base. */
export const UNLIMITED = 9999;
export const limitLabel = (n: number | undefined, unlimited = "Ilimitados") =>
  n === undefined ? "—" : n >= UNLIMITED ? unlimited : String(n);
