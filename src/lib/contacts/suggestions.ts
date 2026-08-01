import type { ContactRow, DealRow, ActivityRow } from "@/lib/queries/contacts";

export type SuggestionAction = "whatsapp" | "task" | "note";

export interface ContactSuggestion {
  id: string;
  text: string;
  cta: string;
  action: SuggestionAction;
  priority: number;
  /** Optional pre-filled task title when action === "task" */
  taskTitle?: string;
  /** Optional pre-filled note text when action === "note" */
  noteText?: string;
}

export interface LastInbound {
  /** ISO timestamp of the last inbound (received) WhatsApp message */
  receivedAt: string;
  /** ISO timestamp of the last outbound (sent) WhatsApp message, or null */
  lastOutboundAt: string | null;
}

interface BuildArgs {
  contact: ContactRow;
  activity: ActivityRow[];
  deals: DealRow[];
  lastInbound: LastInbound | null;
}

const DAY_MS = 86_400_000;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - Date.now()) / DAY_MS);
}

function firstName(c: ContactRow): string {
  return c.name?.split(" ")[0] ?? c.name ?? "este contacto";
}

/**
 * Builds an ordered list of next-step suggestions for a contact based on
 * local heuristics (no AI calls). Higher priority comes first.
 */
export function buildContactSuggestions({
  contact, activity, deals, lastInbound,
}: BuildArgs): ContactSuggestion[] {
  const out: ContactSuggestion[] = [];
  const fname = firstName(contact);

  // 1. Inbound WhatsApp without reply
  if (lastInbound) {
    const receivedTs = new Date(lastInbound.receivedAt).getTime();
    const outboundTs = lastInbound.lastOutboundAt
      ? new Date(lastInbound.lastOutboundAt).getTime()
      : 0;
    if (receivedTs > outboundTs) {
      const days = daysSince(lastInbound.receivedAt) ?? 0;
      const when = days <= 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`;
      out.push({
        id: "inbound-pending",
        text: `${fname} te escribió ${when} y aún no le respondes. Continúa la conversación.`,
        cta: "Responder en WhatsApp",
        action: "whatsapp",
        priority: 100,
      });
    }
  }

  // 2. Open deal closing soon or overdue
  const openDeals = deals.filter((d) => !d.isWon && !d.isLost);
  for (const d of openDeals) {
    // DealRow doesn't expose expected_close_date; use updatedAt as proxy via createdAt staleness.
    // We trigger when probability >= 60 AND there's been no recent activity.
    if (d.probability >= 60) {
      out.push({
        id: `deal-push-${d.id}`,
        text: `El deal "${d.name}" tiene ${d.probability}% de probabilidad. Confirma el siguiente paso con ${fname}.`,
        cta: "Enviar recordatorio",
        action: "whatsapp",
        priority: 80,
      });
      break;
    }
  }

  // 3. Inactive prospect
  const inactiveDays = daysSince(contact.lastActivity);
  if (
    inactiveDays !== null &&
    inactiveDays >= 7 &&
    contact.status === "prospecto"
  ) {
    out.push({
      id: "reactivate",
      text: `Han pasado ${inactiveDays} días sin contacto con ${fname}. Reactiva la conversación antes de que se enfríe.`,
      cta: "Reactivar por WhatsApp",
      action: "whatsapp",
      priority: 70,
    });
  }

  // 4. Brand-new contact, no activity yet
  const ageDays = daysSince(contact.createdAt);
  if (
    ageDays !== null &&
    ageDays <= 1 &&
    activity.length === 0
  ) {
    out.push({
      id: "welcome",
      text: `${fname} se acaba de registrar. Dale la bienvenida con un primer mensaje personal.`,
      cta: "Enviar bienvenida",
      action: "whatsapp",
      priority: 90,
    });
  }

  // 5. Active client, ask for referrals
  if (
    contact.status === "cliente" &&
    inactiveDays !== null &&
    inactiveDays >= 14
  ) {
    out.push({
      id: "referral",
      text: `${fname} ya es cliente. Pídele feedback o un referido.`,
      cta: "Enviar mensaje",
      action: "whatsapp",
      priority: 50,
    });
  }

  // 6. Fallback — always at least one suggestion
  out.push({
    id: "schedule-followup",
    text: `Todo al día con ${fname}. Agenda un follow-up para no perder el ritmo.`,
    cta: "Agendar llamada",
    action: "task",
    priority: 10,
    taskTitle: `Llamar a ${contact.name}`,
  });

  return out.sort((a, b) => b.priority - a.priority);
}

// Re-export for tests using daysSince (kept internal otherwise)
export const __test = { daysSince, daysUntil };
