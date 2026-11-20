// Enrutamiento de llamadas entrantes (PBX) compartido por telephony-api (simulador) y telephony-webhook (proveedor real).
// deno-lint-ignore-file no-explicit-any

export interface PbxConfig {
  enabled?: boolean;
  welcome_message?: string;
  voicemail_message?: string;
  hours?: { days?: number[]; open?: string; close?: string; timezone?: string };
  menu?: { digit: string; label: string; target: "assigned" | "queue" | "voicemail" | "user"; user_id?: string }[];
  queue_user_ids?: string[];
}

export function isOpen(cfg: PbxConfig, fallbackTz: string, now = new Date()): boolean {
  const h = cfg.hours;
  if (!h || !h.open || !h.close) return true;
  const tz = h.timezone || fallbackTz || "America/Mexico_City";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  const hh = (parts.find((p) => p.type === "hour")?.value ?? "00").replace("24", "00");
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const cur = `${hh}:${mm}`;
  const days = h.days ?? [1, 2, 3, 4, 5];
  return days.includes(day) && cur >= h.open && cur < h.close;
}

function digits(s: string) { return (s ?? "").replace(/\D/g, ""); }

export async function routeInboundCall(admin: any, opts: {
  channel: any; fromNumber: string; digit?: string | null; providerCallId: string; notificationOnly?: boolean; useReceivingPreference?: boolean;
}) {
  const { channel, fromNumber, digit, providerCallId, notificationOnly = false } = opts;
  const cfg: PbxConfig = channel.pbx_config ?? {};
  const tenantId = channel.tenant_id;

  const { data: tenant } = await admin.from("tenants").select("timezone").eq("id", tenantId).maybeSingle();
  const open = cfg.enabled === false ? true : isOpen(cfg, tenant?.timezone ?? "America/Mexico_City");

  // Identificar al lead por los últimos 10 dígitos
  const last10 = digits(fromNumber).slice(-10);
  let contact: any = null;
  if (last10.length >= 7) {
    const { data } = await admin.from("contacts").select("id, owner_id, name")
      .eq("tenant_id", tenantId).ilike("phone", `%${last10}`)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    contact = data;
  }

  const option = digit ? (cfg.menu ?? []).find((m) => m.digit === digit) : undefined;
  let target: string = option?.target ?? (contact?.owner_id ? "assigned" : "queue");
  if (!open) target = "voicemail";

  let userId: string | null = null;
  if (target === "assigned") userId = contact?.owner_id ?? null;
  if (target === "user") userId = option?.user_id ?? null;
  if ((target === "queue" || (target === "assigned" && !userId)) && (cfg.queue_user_ids ?? []).length) {
    // Reparto: el asesor de la fila con menos llamadas entrantes hoy
    const ids = cfg.queue_user_ids ?? [];
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { data: recent } = await admin.from("calls").select("user_id")
      .eq("tenant_id", tenantId).eq("direction", "inbound").in("user_id", ids)
      .gte("created_at", since.toISOString());
    const count: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]));
    (recent ?? []).forEach((r: any) => { count[r.user_id] = (count[r.user_id] ?? 0) + 1; });
    userId = ids.slice().sort((a, b) => count[a] - count[b])[0] ?? null;
  }
  if (target === "voicemail") userId = contact?.owner_id ?? null;

  // Never route a stale configuration to someone outside this company.
  if (userId) {
    const { data: roles, error: rolesError } = await admin.from("user_roles").select("user_id").eq("tenant_id", tenantId).eq("user_id", userId).limit(1);
    const { data: member, error: memberError } = await admin.from("profiles").select("is_active").eq("id", userId).maybeSingle();
    if (rolesError || memberError) throw rolesError ?? memberError;
    if (!roles?.length || !member?.is_active) userId = null;
  }

  let receivingPhone: string | null = null;
  if (opts.useReceivingPreference && userId && open && target !== "voicemail") {
    const { data: preference, error: preferenceError } = await admin.from("tenant_call_receiving_preferences").select("phone_enabled,phone_number")
      .eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle();
    if (preferenceError) throw preferenceError;
    if (preference?.phone_enabled && /^\+[1-9]\d{7,14}$/.test(preference.phone_number ?? "")) receivingPhone = preference.phone_number;
  }
  const notifyOnly = opts.useReceivingPreference ? !receivingPhone : notificationOnly;

  let dealId: string | null = null;
  if (contact) {
    const { data: deal } = await admin.from("deals").select("id").eq("contact_id", contact.id)
      .eq("tenant_id", tenantId).eq("is_won", false).eq("is_lost", false).order("created_at", { ascending: false }).limit(1).maybeSingle();
    dealId = deal?.id ?? null;
  }

  const now = new Date().toISOString();
  const { data: call, error } = await admin.from("calls").insert({
    tenant_id: tenantId,
    channel_id: channel.id,
    contact_id: contact?.id ?? null,
    deal_id: dealId,
    user_id: userId,
    direction: "inbound",
    from_number: fromNumber,
    to_number: channel.phone_number,
    status: notifyOnly || !userId ? "no_answer" : target === "voicemail" ? "voicemail" : "ringing",
    provider_call_id: providerCallId,
    started_at: now,
    ended_at: notifyOnly || !userId || target === "voicemail" ? now : null,
    outcome: notifyOnly ? "Entrante registrada para devolución; sin conexión con asesor" : target === "voicemail" ? (open ? "Enviada a buzón por menú" : "Fuera de horario: buzón de voz") : !userId ? "Sin asesor disponible" : null,
    metadata: { notification_only: notifyOnly, receiving_phone: receivingPhone, pbx: { digit: digit ?? null, option: option?.label ?? null, target, open } },
  }).select("id, status, user_id, contact_id").single();
  if (error) {
    if (error.code !== "23505") throw error;
    const { data: existing, error: existingError } = await admin.from("calls").select("id,status,user_id,contact_id,metadata")
      .eq("tenant_id", tenantId).eq("channel_id", channel.id).eq("direction", "inbound").eq("provider_call_id", providerCallId).single();
    if (existingError) throw existingError;
    return { call: existing, open, target, receivingPhone: existing?.status === "ringing" ? existing.metadata?.receiving_phone ?? null : null, greeting: open ? cfg.welcome_message : cfg.voicemail_message };
  }

  return { call, open, target, receivingPhone, greeting: open ? cfg.welcome_message : cfg.voicemail_message };
}
