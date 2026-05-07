// Helper compartido para entregar notificaciones respetando los toggles
// del perfil IA del usuario (notify_only_work_hours, notify_digest_9am).
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
}

const TZ = "America/Mexico_City";

function localDateParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { hour: parseInt(get("hour"), 10), weekday: get("weekday") };
}

export function isWithinWorkHours(d: Date) {
  const { hour, weekday } = localDateParts(d);
  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
  return isWeekday && hour >= 8 && hour < 19;
}

export function nextWorkHourStart(d: Date): Date {
  const next = new Date(d.getTime());
  for (let i = 0; i < 96; i++) {
    next.setHours(next.getHours() + 1);
    if (isWithinWorkHours(next)) return next;
  }
  return next;
}

export function nextDigest9amCDMX(d: Date): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const todayCdmx = fmt.format(d);
  const today9 = new Date(`${todayCdmx}T09:00:00-06:00`);
  if (today9.getTime() > d.getTime()) return today9;
  return new Date(today9.getTime() + 24 * 3600 * 1000);
}

export async function deliverNotification(sb: SupabaseClient, n: NotificationInput): Promise<{ delivered: boolean; queued?: boolean; reason?: string }> {
  const { data: profile } = await sb.from("ai_user_profile")
    .select("notify_only_work_hours, notify_digest_9am")
    .eq("user_id", n.userId).maybeSingle();

  const now = new Date();
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
    deliverAfter = nextDigest9amCDMX(now);
    reason = "digest_9am";
  } else if (wantsWorkHoursOnly && !isWithinWorkHours(now)) {
    deliverAfter = nextWorkHourStart(now);
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
