/**
 * Mock data for the Reports module (/reports).
 * Realistic Mexican PyME context (MXN), 4 sellers, last full month.
 * Designed so it can be swapped 1:1 for a future `useReportsData()` hook.
 */

export type SellerId = "ml" | "cr" | "at" | "dp";

export interface SellerProfile {
  id: SellerId;
  initials: string;
  name: string;
  color: string; // hsl token reference
}

export const sellers: SellerProfile[] = [
  { id: "ml", initials: "ML", name: "María López",  color: "hsl(var(--primary))" },
  { id: "cr", initials: "CR", name: "Carlos Ruiz",  color: "hsl(var(--accent))" },
  { id: "at", initials: "AT", name: "Ana Torres",   color: "hsl(var(--success))" },
  { id: "dp", initials: "DP", name: "Diego Pérez",  color: "hsl(var(--warning))" },
];

// ─────────────────────────────────────────────────────────────────
// KPI hero row (with MoM deltas)
// ─────────────────────────────────────────────────────────────────
export interface KpiCard {
  id: "revenue" | "pipeline" | "closeRate" | "cycle";
  label: string;
  value: string;
  rawValue: number;
  delta: number; // percentage vs previous period (e.g. 12 = +12%)
  hint: string;
}

export const kpiCards: KpiCard[] = [
  { id: "revenue",   label: "Revenue cerrado",  value: "$487,300 MXN", rawValue: 487300, delta: 12,  hint: "vs mes anterior" },
  { id: "pipeline",  label: "Pipeline activo",  value: "$1,245,800 MXN", rawValue: 1245800, delta: 8,   hint: "vs mes anterior" },
  { id: "closeRate", label: "Tasa de cierre",   value: "34%",            rawValue: 34, delta: 3,    hint: "+3 pts vs mes anterior" },
  { id: "cycle",     label: "Ciclo promedio",   value: "18 días",        rawValue: 18, delta: -6,   hint: "más rápido vs mes anterior" },
];

// ─────────────────────────────────────────────────────────────────
// §1 — Sales funnel (7 stages)
// ─────────────────────────────────────────────────────────────────
export interface FunnelStage {
  id: string;
  name: string;
  count: number;
  value: number;
  conversionFromPrev: number | null; // null for first stage
}

export const funnelStages: FunnelStage[] = [
  { id: "lead",         name: "Lead",         count: 184, value: 2_950_000, conversionFromPrev: null },
  { id: "contacted",    name: "Contactado",   count: 142, value: 2_380_000, conversionFromPrev: 77 },
  { id: "qualified",    name: "Calificado",   count:  98, value: 1_870_000, conversionFromPrev: 69 },
  { id: "demo",         name: "Demo",         count:  62, value: 1_320_000, conversionFromPrev: 63 },
  { id: "proposal",     name: "Propuesta",    count:  41, value:   985_000, conversionFromPrev: 66 },
  { id: "negotiation",  name: "Negociación",  count:   9, value:   245_000, conversionFromPrev: 22 },
  { id: "won",          name: "Cierre",       count:   7, value:   487_300, conversionFromPrev: 78 },
];

// ─────────────────────────────────────────────────────────────────
// §2 — Seller performance
// ─────────────────────────────────────────────────────────────────
export interface SellerPerformance {
  sellerId: SellerId;
  leadsAssigned: number;
  activeDeals: number;
  closedDeals: number;
  revenueGenerated: number;
  avgCloseDays: number;
  closeRate: number; // 0–100
}

export const sellerPerformance: SellerPerformance[] = [
  { sellerId: "ml", leadsAssigned: 52, activeDeals: 14, closedDeals: 9, revenueGenerated: 198_400, avgCloseDays: 14, closeRate: 41 },
  { sellerId: "cr", leadsAssigned: 48, activeDeals: 11, closedDeals: 6, revenueGenerated: 132_700, avgCloseDays: 19, closeRate: 32 },
  { sellerId: "at", leadsAssigned: 44, activeDeals:  9, closedDeals: 5, revenueGenerated:  98_200, avgCloseDays: 22, closeRate: 28 },
  { sellerId: "dp", leadsAssigned: 40, activeDeals:  7, closedDeals: 3, revenueGenerated:  58_000, avgCloseDays: 26, closeRate: 18 },
];

export interface SellerDeal {
  id: string;
  contact: string;
  stage: string;
  amount: number;
  status: "active" | "won" | "lost";
  daysInStage: number;
}

export const sellerDeals: Record<SellerId, SellerDeal[]> = {
  ml: [
    { id: "d-ml-1", contact: "Restaurante La Plaza",   stage: "Negociación", amount:  48_000, status: "active", daysInStage: 3 },
    { id: "d-ml-2", contact: "Distribuidora Norte",    stage: "Propuesta",   amount:  72_000, status: "active", daysInStage: 5 },
    { id: "d-ml-3", contact: "Hotel Misión",           stage: "Cierre",      amount:  56_000, status: "won",    daysInStage: 1 },
    { id: "d-ml-4", contact: "Pedro Sánchez",          stage: "Demo",        amount:  22_400, status: "active", daysInStage: 8 },
  ],
  cr: [
    { id: "d-cr-1", contact: "Tienda Don Beto",        stage: "Propuesta",   amount:  38_000, status: "active", daysInStage: 6 },
    { id: "d-cr-2", contact: "Café Central",           stage: "Negociación", amount:  29_500, status: "active", daysInStage: 4 },
    { id: "d-cr-3", contact: "Panadería La Esquina",   stage: "Cierre",      amount:  18_200, status: "won",    daysInStage: 2 },
  ],
  at: [
    { id: "d-at-1", contact: "Lucía Hernández",        stage: "Calificado",  amount:  14_000, status: "active", daysInStage: 10 },
    { id: "d-at-2", contact: "Mariana Vega",           stage: "Demo",        amount:  31_500, status: "active", daysInStage: 7 },
    { id: "d-at-3", contact: "Roberto Salinas",        stage: "Cierre",      amount:  22_000, status: "won",    daysInStage: 1 },
  ],
  dp: [
    { id: "d-dp-1", contact: "Constructora Ávila",     stage: "Demo",        amount:  19_000, status: "active", daysInStage: 12 },
    { id: "d-dp-2", contact: "Auto Servicio MX",       stage: "Calificado",  amount:  12_400, status: "active", daysInStage: 9 },
  ],
};

// ─────────────────────────────────────────────────────────────────
// §3 — Lead sources (pie)
// ─────────────────────────────────────────────────────────────────
export interface LeadSource {
  id: "whatsapp" | "web" | "referral" | "manual" | "social";
  name: string;
  count: number;
  revenue: number;
  color: string; // hex (used directly by recharts Pie)
}

export const leadSources: LeadSource[] = [
  { id: "whatsapp", name: "WhatsApp",       count: 86, revenue: 331_300, color: "#25D366" },
  { id: "web",      name: "Formulario web", count: 38, revenue:  82_400, color: "#4F46E5" },
  { id: "referral", name: "Referido",       count: 24, revenue:  44_900, color: "#06B6D4" },
  { id: "manual",   name: "Manual",         count: 22, revenue:  18_700, color: "#64748B" },
  { id: "social",   name: "Redes sociales", count: 14, revenue:  10_000, color: "#EC4899" },
];

// ─────────────────────────────────────────────────────────────────
// §4 — Lost deals
// ─────────────────────────────────────────────────────────────────
export interface LostReason {
  id: string;
  reason: string;
  count: number;
  amount: number;
}

export const lostReasons: LostReason[] = [
  { id: "price",       reason: "Precio muy alto",            count: 8, amount: 145_000 },
  { id: "competition", reason: "Se fue con la competencia",  count: 5, amount:  92_000 },
  { id: "timing",      reason: "No era el momento",          count: 4, amount:  58_000 },
  { id: "no_reply",    reason: "Sin respuesta",              count: 3, amount:  32_000 },
];

export const lostTotalAmount = lostReasons.reduce((s, r) => s + r.amount, 0);

// ─────────────────────────────────────────────────────────────────
// §5 — Team activity heatmap (7 days × 4 sellers)
// ─────────────────────────────────────────────────────────────────
export interface HeatmapCell {
  whatsapp: number;
  notes: number;
  dealsMoved: number;
}

export const heatmapDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

export const heatmap: Record<SellerId, HeatmapCell[]> = {
  ml: [
    { whatsapp: 18, notes: 4, dealsMoved: 3 }, { whatsapp: 22, notes: 6, dealsMoved: 4 },
    { whatsapp: 14, notes: 3, dealsMoved: 2 }, { whatsapp: 28, notes: 5, dealsMoved: 5 },
    { whatsapp: 19, notes: 4, dealsMoved: 3 }, { whatsapp: 6,  notes: 1, dealsMoved: 1 },
    { whatsapp: 0,  notes: 0, dealsMoved: 0 },
  ],
  cr: [
    { whatsapp: 14, notes: 3, dealsMoved: 2 }, { whatsapp: 16, notes: 4, dealsMoved: 3 },
    { whatsapp: 11, notes: 2, dealsMoved: 1 }, { whatsapp: 19, notes: 4, dealsMoved: 2 },
    { whatsapp: 12, notes: 3, dealsMoved: 2 }, { whatsapp: 4,  notes: 1, dealsMoved: 0 },
    { whatsapp: 0,  notes: 0, dealsMoved: 0 },
  ],
  at: [
    { whatsapp: 9,  notes: 2, dealsMoved: 1 }, { whatsapp: 12, notes: 3, dealsMoved: 2 },
    { whatsapp: 8,  notes: 2, dealsMoved: 1 }, { whatsapp: 14, notes: 3, dealsMoved: 2 },
    { whatsapp: 10, notes: 2, dealsMoved: 1 }, { whatsapp: 2,  notes: 0, dealsMoved: 0 },
    { whatsapp: 0,  notes: 0, dealsMoved: 0 },
  ],
  dp: [
    { whatsapp: 4,  notes: 1, dealsMoved: 0 }, { whatsapp: 6,  notes: 1, dealsMoved: 1 },
    { whatsapp: 3,  notes: 0, dealsMoved: 0 }, { whatsapp: 8,  notes: 2, dealsMoved: 1 },
    { whatsapp: 5,  notes: 1, dealsMoved: 0 }, { whatsapp: 0,  notes: 0, dealsMoved: 0 },
    { whatsapp: 0,  notes: 0, dealsMoved: 0 },
  ],
};

// ─────────────────────────────────────────────────────────────────
// §6 — Stage-to-stage conversions
// ─────────────────────────────────────────────────────────────────
export interface StageConversion {
  from: string;
  to: string;
  advanced: number;
  rate: number; // 0–100
}

export const stageConversions: StageConversion[] = [
  { from: "Lead",        to: "Contactado",   advanced: 142, rate: 77 },
  { from: "Contactado",  to: "Calificado",   advanced:  98, rate: 69 },
  { from: "Calificado",  to: "Demo",         advanced:  62, rate: 63 },
  { from: "Demo",        to: "Propuesta",    advanced:  41, rate: 66 },
  { from: "Propuesta",   to: "Negociación",  advanced:   9, rate: 22 },
  { from: "Negociación", to: "Cierre",       advanced:   7, rate: 78 },
];

// ─────────────────────────────────────────────────────────────────
// Insights IA (mock; el resumen ejecutivo viene del edge function real)
// ─────────────────────────────────────────────────────────────────
export const sourceInsight =
  "WhatsApp es tu fuente más rentable — genera el 68% de tu revenue.";
export const lostInsight =
  "El precio es tu principal objeción. ¿Quieres ver qué argumentos usó tu mejor vendedor?";
export const conversionInsight =
  "Solo el 22% pasa de Propuesta a Negociación — esta es tu mayor oportunidad.";