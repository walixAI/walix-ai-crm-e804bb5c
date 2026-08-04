/** Etiquetas homologadas de planes (empresa y organización). */
export const TENANT_PLAN_LABEL: Record<string, string> = {
  pyme: "PyME",
  growth: "Growth",
  enterprise: "Enterprise",
};

export const ORG_PLAN_LABEL: Record<string, string> = {
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

/** Días de prueba gratuita (reemplaza al plan gratuito). */
export const TRIAL_DAYS = 14;

/** Catálogo comercial de planes (fuente única para landing, pricing y facturación). */
export interface PlanPricing {
  key: "pyme" | "growth" | "enterprise";
  name: string;
  monthly: number;
  annual: number; // por mes pagando anual
  users: string;
  pipelines: string;
  whatsappCredits: number;
  aiCredits: number;
  aiEngine: string;
}

export const PLAN_PRICING: PlanPricing[] = [
  {
    key: "pyme",
    name: "PyME",
    monthly: 899,
    annual: 719,
    users: "5",
    pipelines: "2",
    whatsappCredits: 100,
    aiCredits: 1000,
    aiEngine: "Walix IA · Estándar",
  },
  {
    key: "growth",
    name: "Growth",
    monthly: 1499,
    annual: 1199,
    users: "15",
    pipelines: "5",
    whatsappCredits: 150,
    aiCredits: 4000,
    aiEngine: "Walix IA · Avanzado",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    monthly: 2500,
    annual: 2000,
    users: "Ilimitados",
    pipelines: "Ilimitados",
    whatsappCredits: 250,
    aiCredits: 10000,
    aiEngine: "Walix IA · Premium",
  },
];

export const planPricing = (plan?: string | null) =>
  PLAN_PRICING.find((p) => p.key === plan) ?? null;

/** Nombres comerciales de los motores de IA (el tenant nunca ve el modelo real). */
export const AI_VENDOR_LABEL: Record<string, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Claude",
};

export const aiVendorLabel = (v?: string | null) =>
  (v && AI_VENDOR_LABEL[v]) || v || "—";

export const formatMXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
