// Helpers compartidos de campañas de WhatsApp: condiciones, horario y envío por Meta.
import { toWaId } from "./phone.ts";

const META_API = "https://graph.facebook.com/v20.0";

export interface CampaignConditions {
  source_kinds?: string[];
  ga_channels?: string[];
  utm_sources?: string[];
  utm_campaigns?: string[];
  cities?: string[];
  regions?: string[];
  products?: string[];
  tags?: string[];
  owner_ids?: string[];
  stage_ids?: string[];
  lifecycle?: string[];
  no_reply_days?: number | null;
  created_within_days?: number | null;
}

export interface Schedule {
  days?: number[]; // 0=domingo .. 6=sábado
  start?: string;  // "09:00"
  end?: string;    // "20:00"
  tz?: string;
}

/** ¿Se puede enviar ahora según el horario permitido de la campaña? */
export function isWithinSchedule(schedule: Schedule | null | undefined, now = new Date()): boolean {
  if (!schedule) return true;
  const tz = schedule.tz || "America/Mexico_City";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[String(parts.weekday)] ?? now.getUTCDay();
  const days = schedule.days ?? [1, 2, 3, 4, 5];
  if (!days.includes(day)) return false;
  const mins = Number(parts.hour) * 60 + Number(parts.minute);
  const toMin = (s?: string, fallback = 0) => {
    if (!s) return fallback;
    const [h, m] = s.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  return mins >= toMin(schedule.start, 0) && mins <= toMin(schedule.end, 24 * 60);
}

/**
 * Aplica las condiciones a una consulta de contactos.
 * Devuelve los ids de contacto que cumplen (evalúa siempre el JSON resuelto, nunca el prompt).
 */
export async function matchContacts(
  sb: any,
  tenantId: string,
  conditions: CampaignConditions,
  limit = 500,
): Promise<{ ids: string[]; total: number }> {
  const c = conditions ?? {};
  let query = sb
    .from("contacts")
    .select("id, tags, owner_id, custom_fields, created_at, last_activity_at, status, contact_attribution!inner(ga_channel, city, region, utm_source, utm_campaign, source_kind, touch_type)", { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("contact_attribution.touch_type", "first")
    .not("phone", "is", null);

  const attrFilters: Array<[string, string[] | undefined]> = [
    ["contact_attribution.ga_channel", c.ga_channels],
    ["contact_attribution.city", c.cities],
    ["contact_attribution.region", c.regions],
    ["contact_attribution.utm_source", c.utm_sources],
    ["contact_attribution.utm_campaign", c.utm_campaigns],
    ["contact_attribution.source_kind", c.source_kinds],
  ];
  for (const [col, values] of attrFilters) {
    if (values && values.length) query = query.in(col, values);
  }
  if (c.owner_ids?.length) query = query.in("owner_id", c.owner_ids);
  if (c.lifecycle?.length) query = query.in("status", c.lifecycle);
  if (c.tags?.length) query = query.overlaps("tags", c.tags);
  if (c.created_within_days) {
    const since = new Date(Date.now() - c.created_within_days * 86400_000).toISOString();
    query = query.gte("created_at", since);
  }
  if (c.no_reply_days) {
    const before = new Date(Date.now() - c.no_reply_days * 86400_000).toISOString();
    query = query.or(`last_activity_at.is.null,last_activity_at.lt.${before}`);
  }

  const { data, error, count } = await query.limit(limit);
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as any[];

  // Producto vive en custom_fields → se filtra en memoria.
  if (c.products?.length) {
    const wanted = c.products.map((p) => p.toLowerCase());
    rows = rows.filter((r) => {
      const cf = r.custom_fields ?? {};
      const val = String(cf.producto ?? cf.product ?? cf.programa ?? "").toLowerCase();
      return wanted.some((w) => val.includes(w));
    });
  }

  // Etapa del pipeline: se verifica contra deals abiertos del contacto.
  if (c.stage_ids?.length && rows.length) {
    const { data: deals } = await sb
      .from("deals")
      .select("contact_id")
      .eq("tenant_id", tenantId)
      .in("stage_id", c.stage_ids)
      .in("contact_id", rows.map((r) => r.id));
    const allowed = new Set((deals ?? []).map((d: any) => d.contact_id));
    rows = rows.filter((r) => allowed.has(r.id));
  }

  return { ids: rows.map((r) => r.id), total: c.products?.length || c.stage_ids?.length ? rows.length : (count ?? rows.length) };
}

export interface WaChannel {
  id: string;
  access_token: string | null;
  phone_number_id: string | null;
  status: string;
}

export async function defaultClientsChannel(sb: any, tenantId: string): Promise<WaChannel | null> {
  const { data } = await sb
    .from("whatsapp_channels")
    .select("id, access_token, phone_number_id, status")
    .eq("tenant_id", tenantId)
    .eq("kind", "clients")
    .neq("status", "disabled")
    .order("is_default", { ascending: false })
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as WaChannel) ?? null;
}

export function renderText(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => vars[k] ?? "");
}

export async function sendTemplate(
  channel: WaChannel,
  to: string,
  templateName: string,
  language: string,
  params: string[],
): Promise<{ wamid?: string; error?: string }> {
  if (!channel.access_token || !channel.phone_number_id) return { error: "Canal de WhatsApp sin credenciales" };
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: toWaId(to),
    type: "template",
    template: {
      name: templateName,
      language: { code: language || "es_MX" },
      ...(params.length
        ? { components: [{ type: "body", parameters: params.map((t) => ({ type: "text", text: t })) }] }
        : {}),
    },
  };
  return await postToMeta(channel, body);
}

export async function sendText(channel: WaChannel, to: string, text: string): Promise<{ wamid?: string; error?: string }> {
  if (!channel.access_token || !channel.phone_number_id) return { error: "Canal de WhatsApp sin credenciales" };
  return await postToMeta(channel, {
    messaging_product: "whatsapp",
    to: toWaId(to),
    type: "text",
    text: { body: text },
  });
}

async function postToMeta(channel: WaChannel, body: Record<string, unknown>) {
  try {
    const res = await fetch(`${META_API}/${channel.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channel.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = json?.error?.message ?? `HTTP ${res.status}`;
      console.error("meta send failed", res.status, JSON.stringify(json).slice(0, 500));
      return { error: detail };
    }
    return { wamid: json?.messages?.[0]?.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error de red con Meta" };
  }
}

/** ¿La ventana de servicio de 24 h sigue abierta para este contacto? */
export async function serviceWindowOpen(sb: any, tenantId: string, contactId: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await sb
    .from("conversations")
    .select("id, messages!inner(id, direction, created_at)")
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .eq("messages.direction", "inbound")
    .gte("messages.created_at", since)
    .limit(1);
  return !!(data && data.length);
}

export async function ensureConversation(sb: any, tenantId: string, contactId: string, channelId: string | null): Promise<string | null> {
  const { data: conv } = await sb
    .from("conversations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (conv?.id) return conv.id;
  const { data: created } = await sb
    .from("conversations")
    .insert({ tenant_id: tenantId, contact_id: contactId, channel_id: channelId, status: "Nuevo" })
    .select("id")
    .single();
  return created?.id ?? null;
}
