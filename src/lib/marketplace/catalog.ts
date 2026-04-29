import {
  Smartphone,
  Bot,
  Mic,
  BarChart3,
  Link2,
  Building2,
  Code2,
  Zap,
  CreditCard,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type ModuleCategory =
  | "Movilidad"
  | "IA Avanzada"
  | "Integraciones"
  | "Analytics"
  | "Voz"
  | "Industria"
  | "API";

export type PricingModel =
  | "per_instance"
  | "per_execution"
  | "per_minute"
  | "per_volume"
  | "per_domain"
  | "per_vertical"
  | "per_automation"
  | "free";

export type MinPlan = "starter" | "pyme" | "growth" | "enterprise";

export interface ModuleDef {
  id: string;
  name: string;
  category: ModuleCategory;
  icon: LucideIcon;
  /** Tailwind bg class for the icon tile (works in both themes via tokens) */
  bgClass: string;
  iconClass: string;
  shortDescription: string;
  longDescription: string;
  features: string[];
  pricingModel: PricingModel;
  /** Monthly fixed price in MXN. 0 for usage-based or free. */
  monthlyPriceMxn: number;
  /** Short label for price (e.g. "$199 MXN/mes", "Por minuto", "Gratis"). */
  priceLabel: string;
  priceUnitLabel: string;
  minPlan: MinPlan;
  comingSoon?: boolean;
  notes?: string;
}

export const PLAN_RANK: Record<MinPlan, number> = {
  starter: 0,
  pyme: 1,
  growth: 2,
  enterprise: 3,
};

export const PLAN_LABEL: Record<MinPlan, string> = {
  starter: "Starter",
  pyme: "PyME",
  growth: "Growth",
  enterprise: "Enterprise",
};

export const CATEGORIES: ModuleCategory[] = [
  "Movilidad",
  "IA Avanzada",
  "Integraciones",
  "Analytics",
  "Voz",
  "Industria",
  "API",
];

export const MODULE_CATALOG: ModuleDef[] = [
  {
    id: "mod-01",
    name: "App Móvil iOS & Android",
    category: "Movilidad",
    icon: Smartphone,
    bgClass: "bg-success/10",
    iconClass: "text-success",
    shortDescription:
      "App nativa para vendedores con vista offline, registro por voz y notificaciones push.",
    longDescription:
      "Aplicación nativa iOS y Android para tu equipo de ventas en campo. Acceso offline a contactos y deals, captura de notas por voz, escaneo de tarjetas y notificaciones push en tiempo real.",
    features: [
      "App nativa iOS y Android",
      "Modo offline con sincronización automática",
      "Registro de notas por voz",
      "Notificaciones push de leads y mensajes",
      "Escaneo de tarjetas de presentación",
      "Geolocalización de visitas",
    ],
    pricingModel: "per_instance",
    monthlyPriceMxn: 199,
    priceLabel: "$199 MXN/mes",
    priceUnitLabel: "por instancia",
    minPlan: "starter",
  },
  {
    id: "mod-05",
    name: "Agentes IA Autónomos",
    category: "IA Avanzada",
    icon: Bot,
    bgClass: "bg-primary/10",
    iconClass: "text-primary",
    shortDescription:
      "Agentes que ejecutan tareas multi-paso de forma autónoma: calificar leads, enviar propuestas, agendar.",
    longDescription:
      "Agentes de IA que toman decisiones y ejecutan flujos de varios pasos sin supervisión: califican leads entrantes, envían propuestas personalizadas, agendan reuniones y dan seguimiento.",
    features: [
      "Calificación automática de leads (BANT/MEDDIC)",
      "Envío de propuestas personalizadas",
      "Agendado automático en calendario",
      "Seguimiento multi-canal",
      "Logs auditables de cada decisión",
    ],
    pricingModel: "per_execution",
    monthlyPriceMxn: 0,
    priceLabel: "$0.50 MXN / ejecución",
    priceUnitLabel: "por ejecución",
    minPlan: "pyme",
  },
  {
    id: "mod-09",
    name: "Interfaz de Voz (Whisper AI)",
    category: "Voz",
    icon: Mic,
    bgClass: "bg-accent/10",
    iconClass: "text-accent-foreground",
    shortDescription:
      "Transcripción automática de notas de voz, llamadas desde el CRM e IVR configurable.",
    longDescription:
      "Conviértela voz en datos estructurados. Transcripción de notas, grabación de llamadas con resumen automático y un IVR configurable para atender leads entrantes.",
    features: [
      "Transcripción de notas de voz (Whisper)",
      "Llamadas salientes desde el CRM",
      "Resumen automático de llamadas",
      "IVR configurable por flujo",
      "Detección de sentimiento",
    ],
    pricingModel: "per_minute",
    monthlyPriceMxn: 0,
    priceLabel: "$1.20 MXN / minuto",
    priceUnitLabel: "por minuto",
    minPlan: "starter",
  },
  {
    id: "mod-10",
    name: "Análisis Avanzado de Datos",
    category: "Analytics",
    icon: BarChart3,
    bgClass: "bg-info/10",
    iconClass: "text-info",
    shortDescription:
      "Cohortes, LTV, churn, BI embebido y preguntas en lenguaje natural a tus datos.",
    longDescription:
      "Inteligencia de negocio embebida con análisis de cohortes, LTV por segmento, churn, y un asistente que responde preguntas en lenguaje natural sobre tus datos.",
    features: [
      "Cohortes y retención",
      "LTV y CAC por segmento",
      "Predicción de churn",
      "Dashboards BI embebidos",
      "Preguntas en lenguaje natural",
      "Exportación a Sheets / Excel",
    ],
    pricingModel: "per_volume",
    monthlyPriceMxn: 499,
    priceLabel: "Desde $499 MXN/mes",
    priceUnitLabel: "por volumen",
    minPlan: "growth",
  },
  {
    id: "mod-04",
    name: "Google Workspace & Microsoft 365",
    category: "Integraciones",
    icon: Link2,
    bgClass: "bg-info/10",
    iconClass: "text-info",
    shortDescription:
      "Sync bidireccional con Gmail, Calendar, Google Maps y Sheets.",
    longDescription:
      "Sincroniza tu equipo con Google Workspace o Microsoft 365: correos, calendarios, contactos, hojas de cálculo y mapas, todo bidireccional.",
    features: [
      "Sync bidireccional Gmail / Outlook",
      "Calendar / Outlook Calendar",
      "Google Maps en visitas",
      "Sheets / Excel para reportes",
      "SSO con Google y Microsoft",
    ],
    pricingModel: "per_domain",
    monthlyPriceMxn: 99,
    priceLabel: "$99 MXN/mes",
    priceUnitLabel: "por dominio",
    minPlan: "starter",
  },
  {
    id: "mod-11",
    name: "Verticales por Industria",
    category: "Industria",
    icon: Building2,
    bgClass: "bg-warning/10",
    iconClass: "text-warning",
    shortDescription:
      "Pipeline, campos, bot y flujos pre-configurados para tu industria: Inmobiliaria, Seguros, Salud y más.",
    longDescription:
      "Plantillas verticales listas para usar: pipeline, campos personalizados, bots de WhatsApp y automatizaciones pre-configuradas para tu industria.",
    features: [
      "Inmobiliaria: propiedades y agendas",
      "Seguros: pólizas y renovaciones",
      "Salud: pacientes y citas (HIPAA-friendly)",
      "Educación: aspirantes e inscripciones",
      "Servicios: presupuestos y órdenes",
    ],
    pricingModel: "per_vertical",
    monthlyPriceMxn: 299,
    priceLabel: "$299 MXN/mes",
    priceUnitLabel: "por vertical",
    minPlan: "starter",
  },
  {
    id: "mod-07",
    name: "API Pública REST",
    category: "API",
    icon: Code2,
    bgClass: "bg-muted",
    iconClass: "text-foreground",
    shortDescription:
      "OpenAPI 3.0, SDK JavaScript/Python, webhooks y sandbox para integraciones custom.",
    longDescription:
      "API REST documentada con OpenAPI 3.0, SDKs oficiales en JS y Python, webhooks firmados y un entorno sandbox para desarrolladores.",
    features: [
      "OpenAPI 3.0 + Swagger UI",
      "SDK JavaScript y Python",
      "Webhooks firmados (HMAC)",
      "Sandbox aislado",
      "Rate limits configurables",
      "Soporte técnico para developers",
    ],
    pricingModel: "per_volume",
    monthlyPriceMxn: 999,
    priceLabel: "Desde $999 MXN/mes",
    priceUnitLabel: "por volumen",
    minPlan: "enterprise",
  },
  {
    id: "mod-08",
    name: "Zapier / Make",
    category: "Integraciones",
    icon: Zap,
    bgClass: "bg-warning/10",
    iconClass: "text-warning",
    shortDescription:
      "Conecta Walix.ai con 5,000+ apps: Gmail, Sheets, Slack, Notion y más sin código.",
    longDescription:
      "Conector oficial para Zapier y Make. Conecta Walix.ai con más de 5,000 aplicaciones sin escribir código. Triggers para nuevos leads, deals ganados, mensajes recibidos y más.",
    features: [
      "Conector oficial verificado",
      "10+ triggers, 15+ acciones",
      "Soporta Zapier y Make",
      "Sin límite de zaps en plan PyME+",
    ],
    pricingModel: "free",
    monthlyPriceMxn: 0,
    priceLabel: "Incluido",
    priceUnitLabel: "sin costo adicional",
    minPlan: "starter",
    notes: "Costos de Zapier/Make corren por cuenta del usuario.",
  },
  // Coming soon
  {
    id: "mod-12",
    name: "Pagos integrados",
    category: "Integraciones",
    icon: CreditCard,
    bgClass: "bg-success/10",
    iconClass: "text-success",
    shortDescription:
      "Cobra a tus clientes desde el CRM con Stripe, Mercado Pago y SPEI.",
    longDescription:
      "Genera links de pago, suscripciones y conciliación automática desde la ficha del deal.",
    features: ["Stripe + Mercado Pago", "Links de pago", "Conciliación automática"],
    pricingModel: "per_volume",
    monthlyPriceMxn: 0,
    priceLabel: "Próximamente",
    priceUnitLabel: "",
    minPlan: "pyme",
    comingSoon: true,
  },
  {
    id: "mod-13",
    name: "Logística & Envíos",
    category: "Integraciones",
    icon: Truck,
    bgClass: "bg-info/10",
    iconClass: "text-info",
    shortDescription:
      "Cotiza y genera guías con DHL, FedEx, Estafeta y paqueterías locales.",
    longDescription:
      "Integración con paqueterías para cotizar, generar guías y rastrear envíos desde el CRM.",
    features: ["Cotización en tiempo real", "Generación de guías", "Tracking unificado"],
    pricingModel: "per_volume",
    monthlyPriceMxn: 0,
    priceLabel: "Próximamente",
    priceUnitLabel: "",
    minPlan: "pyme",
    comingSoon: true,
  },
];

export function getModule(id: string): ModuleDef | undefined {
  return MODULE_CATALOG.find((m) => m.id === id);
}

export type ModuleStatus = "active" | "available" | "plan_locked" | "coming_soon";

export function resolveStatus(
  mod: ModuleDef,
  isActive: boolean,
  currentPlan: string | null | undefined,
): ModuleStatus {
  if (mod.comingSoon) return "coming_soon";
  if (isActive) return "active";
  const planRank = PLAN_RANK[(currentPlan as MinPlan) ?? "starter"] ?? 0;
  if (planRank < PLAN_RANK[mod.minPlan]) return "plan_locked";
  return "available";
}