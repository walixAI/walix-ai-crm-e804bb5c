// Utilidades puras para el cierre inteligente de pendientes.
// - extractKeywords: tokeniza título del pendiente eliminando stopwords.
// - keywordsForTask: incluye tokens del título + refuerzos según task_kind.
// - messageMatchesTask: valida que el texto enviado tenga relación con el pendiente.
// - suggestReschedule: propone próxima fecha según contexto (deal / task_kind).

const STOPWORDS = new Set([
  "de","del","la","el","los","las","un","una","unos","unas","a","al","en","con","sin","por","para",
  "que","y","o","u","e","es","son","este","esta","estos","estas","ese","esa","le","les","lo",
  "su","sus","mi","mis","tu","tus","nos","se","si","no","ya","muy","más","menos","hoy","ayer","mañana",
  "sr","sra","don","dona","sig","sigue","sigues","sigo","desde","hasta","como","cuando","donde",
  "contacto","contactos","cliente","clientes","tarea","tareas","pendiente","pendientes","dias","días",
  "sin","respuesta","reactivar","seguimiento","llamar","enviar","recordar","hacer","revisar",
]);

const KIND_REINFORCE: Record<string, string[]> = {
  cobro: ["pago", "pagar", "cobro", "cobrar", "factura", "saldo", "depósito", "deposito", "transferencia"],
  cotizacion: ["cotización", "cotizacion", "cotizar", "presupuesto", "propuesta", "precio", "descuento"],
  servicio: ["servicio", "visita", "mantenimiento", "instalación", "instalacion", "técnico", "tecnico", "cita"],
  seguimiento: ["seguir", "saber", "novedad", "avance", "decidir", "decisión", "decision", "pensar"],
  refaccion: ["refacción", "refaccion", "pieza", "repuesto"],
  facturacion: ["factura", "facturar", "cfdi", "rfc"],
  devolucion: ["devolución", "devolucion", "cambio", "regresar"],
  queja: ["queja", "problema", "reclamo", "molesto", "disculpa"],
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function extractKeywords(title: string): string[] {
  const toks = norm(title).filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  return Array.from(new Set(toks));
}

export function keywordsForTask(task: { title: string; task_kind?: string | null }, extra?: { contactName?: string | null; dealName?: string | null }): string[] {
  const base = extractKeywords(task.title);
  const kind = (task.task_kind ?? "otro").toLowerCase();
  const reinforce = KIND_REINFORCE[kind] ?? [];
  const ctx = [
    ...(extra?.contactName ? norm(extra.contactName).filter((t) => t.length >= 4) : []),
    ...(extra?.dealName ? norm(extra.dealName).filter((t) => t.length >= 4) : []),
  ];
  return Array.from(new Set([...base, ...reinforce.map((r) => norm(r)[0]).filter(Boolean), ...ctx]));
}

/**
 * true si el texto contiene al menos una keyword relacionada al pendiente.
 * Requiere una lista mínima; si el título no aporta ninguna keyword útil
 * (título ultra-genérico), acepta cualquier texto ≥ 8 chars como válido.
 */
export function messageMatchesTask(text: string, task: { title: string; task_kind?: string | null }, extra?: { contactName?: string | null; dealName?: string | null }): boolean {
  const kws = keywordsForTask(task, extra);
  const body = norm(text);
  if (kws.length === 0) return body.join(" ").length >= 8;
  return kws.some((k) => body.includes(k));
}

/**
 * Propone la próxima fecha para reagendar un pendiente que no se pudo cerrar.
 * Contexto:
 *  - Últimos 3 días hábiles del mes + deal cierra este mes → hoy +2h.
 *  - Deal con probabilidad ≥ 70 → mañana 9:00 local.
 *  - Deal en Negociación/Propuesta → mañana 9:00 local.
 *  - Cobro vencido → mañana 9:00 local.
 *  - Seguimiento / prob. media → +2 días.
 *  - Sin deal / frío → +5 días.
 */
export interface RescheduleSuggestion {
  date: Date;
  reason: string;
}

export function suggestReschedule(
  task: { task_kind?: string | null; dueAt?: string | null },
  deal?: { probability?: number | null; stageName?: string | null; expectedCloseDate?: string | null } | null,
  now: Date = new Date(),
): RescheduleSuggestion {
  const kind = (task.task_kind ?? "otro").toLowerCase();
  const stageLower = (deal?.stageName ?? "").toLowerCase();
  const prob = deal?.probability ?? 0;

  // Fin de mes cercano con deal esperando cierre este mes
  const daysToMonthEnd = daysBetween(now, endOfMonth(now));
  const dealClosesThisMonth = !!deal?.expectedCloseDate && sameMonth(new Date(deal.expectedCloseDate), now);
  if (daysToMonthEnd <= 3 && dealClosesThisMonth) {
    const d = new Date(now); d.setHours(now.getHours() + 2, 0, 0, 0);
    return { date: d, reason: "Cierre de mes: reintenta en 2 horas" };
  }

  // Cobro vencido → mañana temprano
  if (kind === "cobro") {
    return { date: tomorrowAt(now, 9), reason: "Cobro pendiente: reintenta mañana temprano" };
  }

  // Deal caliente
  if (prob >= 70 || /negoc|propuesta/i.test(stageLower)) {
    return { date: tomorrowAt(now, 9), reason: "Oportunidad caliente: reintenta mañana" };
  }

  // Seguimiento / probabilidad media
  if (kind === "seguimiento" || (prob >= 30 && prob < 70)) {
    return { date: addDays(now, 2, 10), reason: "Seguimiento: dale 2 días" };
  }

  // Frío / sin deal
  return { date: addDays(now, 5, 10), reason: "Contacto frío: reintenta en 5 días" };
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}
function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function tomorrowAt(now: Date, hour: number) {
  const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(hour, 0, 0, 0); return d;
}
function addDays(now: Date, days: number, hour = 10) {
  const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d;
}

/**
 * Detecta canal sugerido según task_kind.
 * - cobro/cotizacion/seguimiento/refaccion/facturacion → WhatsApp
 * - queja/devolucion → Llamada
 * - servicio → Otro
 */
export function suggestedChannel(task_kind?: string | null): "whatsapp" | "call" | "other" {
  const k = (task_kind ?? "otro").toLowerCase();
  if (["cobro","cotizacion","seguimiento","refaccion","facturacion"].includes(k)) return "whatsapp";
  if (["queja","devolucion"].includes(k)) return "call";
  return "other";
}

/**
 * Compone un borrador de mensaje contextual según el pendiente.
 */
export function buildDraftMessage(
  task: { title: string; task_kind?: string | null },
  contact?: { firstName?: string | null } | null,
  deal?: { name?: string | null; amount?: number | null } | null,
): string {
  const name = contact?.firstName ? `${contact.firstName}` : "";
  const hi = name ? `Hola ${name},` : "Hola,";
  const kind = (task.task_kind ?? "otro").toLowerCase();
  const dealTag = deal?.name ? ` sobre "${deal.name}"` : "";
  const amount = deal?.amount ? ` (por $${deal.amount.toLocaleString("es-MX")})` : "";

  switch (kind) {
    case "cobro":
      return `${hi} te escribo para dar seguimiento al pago pendiente${dealTag}${amount}. ¿Qué día podemos esperar tu depósito?`;
    case "cotizacion":
      return `${hi} ya tengo lista la cotización${dealTag}. ¿Te la envío por aquí o prefieres correo?`;
    case "seguimiento":
      return `${hi} sigo pendiente de tu decisión${dealTag}. ¿Cómo vas? ¿Puedo ayudarte con algo más?`;
    case "servicio":
      return `${hi} te confirmo el servicio agendado${dealTag}. ¿Sigue en pie el horario?`;
    case "refaccion":
      return `${hi} te aviso sobre la refacción${dealTag}. ¿Confirmas para proceder?`;
    case "facturacion":
      return `${hi} necesito tus datos de facturación${dealTag} para emitir el CFDI. ¿Me los puedes compartir?`;
    default:
      return `${hi} te escribo por lo siguiente: ${task.title}. ¿Cómo te puedo apoyar?`;
  }
}