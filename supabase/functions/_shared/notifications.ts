// Helper compartido para entregar notificaciones respetando los toggles
// del perfil IA del usuario (notify_only_work_hours, notify_digest_9am)
// y la zona horaria del perfil.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

export interface NotificationInput {
  userId: string;
  tenantId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  icon?: string;
  severity?: "info" | "success" | "warning" | "error";
  category?: "operational" | "ai" | "billing" | "security";
  data?: Record<string, unknown>;
  /** TZ explícito; si no se pasa, se busca en profiles.timezone del userId. */
  timezone?: string;
}

const DEFAULT_TZ = "America/Mexico_City";

function localDateParts(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { hour: parseInt(get("hour"), 10), weekday: get("weekday") };
}

export function isWithinWorkHours(d: Date, tz = DEFAULT_TZ) {
  const { hour, weekday } = localDateParts(d, tz);
  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
  return isWeekday && hour >= 8 && hour < 19;
}

export function nextWorkHourStart(d: Date, tz = DEFAULT_TZ): Date {
  const next = new Date(d.getTime());
  for (let i = 0; i < 96; i++) {
    next.setHours(next.getHours() + 1);
    if (isWithinWorkHours(next, tz)) return next;
  }
  return next;
}

/** Próxima ocurrencia de las 9:00 locales en `tz`. */
export function nextDigest9am(d: Date, tz = DEFAULT_TZ): Date {
  // Avanza minuto a minuto en horas locales hasta encontrar hora==9 y minuto<5.
  // Implementación robusta sin depender del offset (DST, etc.).
  const candidate = new Date(d.getTime());
  // Saltamos al siguiente minuto múltiplo de 5 para acotar el loop.
  candidate.setSeconds(0, 0);
  for (let i = 0; i < 60 * 24 * 2; i++) {
    candidate.setMinutes(candidate.getMinutes() + 1);
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = fmt.formatToParts(candidate);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    if (h === 9 && m === 0) return candidate;
  }
  return candidate;
}

async function resolveTimezone(sb: SupabaseClient, userId: string, override?: string): Promise<string> {
  if (override) return override;
  try {
    const { data } = await sb.from("profiles").select("timezone").eq("id", userId).maybeSingle();
    return (data?.timezone as string) || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

export async function deliverNotification(sb: SupabaseClient, n: NotificationInput): Promise<{ delivered: boolean; queued?: boolean; reason?: string }> {
  const { data: profile } = await sb.from("ai_user_profile")
    .select("notify_only_work_hours, notify_digest_9am")
    .eq("user_id", n.userId).maybeSingle();

  const now = new Date();
  const tz = await resolveTimezone(sb, n.userId, n.timezone);
  const wantsDigest = !!profile?.notify_digest_9am;
  const wantsWorkHoursOnly = !!profile?.notify_only_work_hours;

  const payload = {
    tenant_id: n.tenantId,
    user_id: n.userId,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
    icon: n.icon ?? null,
    severity: n.severity ?? "info",
    category: n.category ?? "ai",
    data: n.data ?? {},
  };

  let deliverAfter: Date | null = null;
  let reason = "immediate";

  if (wantsDigest) {
    deliverAfter = nextDigest9am(now, tz);
    reason = "digest_9am";
  } else if (wantsWorkHoursOnly && !isWithinWorkHours(now, tz)) {
    deliverAfter = nextWorkHourStart(now, tz);
    reason = "work_hours";
  }

  if (deliverAfter) {
    const { error } = await sb.from("notifications_queue").insert({
      tenant_id: n.tenantId, user_id: n.userId, payload, reason,
      deliver_after: deliverAfter.toISOString(),
    });
    if (error) return { delivered: false, queued: false, reason: error.message };
    return { delivered: false, queued: true, reason };
  }

  const { error } = await sb.from("notifications").insert(payload);
  if (error) return { delivered: false, reason: error.message };
  return { delivered: true };
}
