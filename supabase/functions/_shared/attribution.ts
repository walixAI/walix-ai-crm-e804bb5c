// Atribución compartida: UTMs, canal estándar GA4, geolocalización por IP y parseo de user agent.

export interface RawAttribution {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  msclkid?: string | null;
  wbraid?: string | null;
  gbraid?: string | null;
  referrer?: string | null;
  landing_url?: string | null;
  source_kind?: string | null;
  meta_ad_id?: string | null;
  meta_adset_id?: string | null;
  meta_campaign_id?: string | null;
  meta_form_id?: string | null;
  meta_platform?: string | null;
  language?: string | null;
  user_agent?: string | null;
}

const SEARCH_ENGINES = ["google", "bing", "yahoo", "duckduckgo", "ecosia", "baidu", "yandex", "brave"];
const SOCIAL = ["facebook", "instagram", "linkedin", "twitter", "x", "tiktok", "pinterest", "reddit", "snapchat", "threads", "whatsapp"];
const VIDEO = ["youtube", "vimeo", "twitch", "dailymotion"];
const SHOPPING = ["amazon", "mercadolibre", "shopify", "ebay"];

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

/** Canal estándar (Default Channel Group) equivalente a GA4. */
export function resolveGaChannel(a: RawAttribution): string {
  const source = norm(a.utm_source);
  const medium = norm(a.utm_medium);
  const campaign = norm(a.utm_campaign);
  const hasPaidClickId = !!(a.gclid || a.msclkid || a.wbraid || a.gbraid);
  const hasFbClickId = !!a.fbclid;
  const referrer = norm(a.referrer);

  const isPaidMedium = /^(cpc|ppc|paid|paidsearch|paid_search|cpm|cpv|cpa|cpp|retargeting|display|banner|expandable|interstitial)$/.test(medium)
    || medium.startsWith("paid");
  const matches = (list: string[], value: string) => list.some((k) => value.includes(k));

  if (campaign.includes("cross-network") || medium === "cross-network") return "Cross-network";
  if (medium === "email" || source === "email" || source === "newsletter" || medium === "e-mail") return "Email";
  if (medium === "affiliate" || medium === "affiliates") return "Affiliates";
  if (medium === "display" || medium === "banner" || medium === "cpm" || medium === "expandable" || medium === "interstitial") return "Display";

  if (isPaidMedium || hasPaidClickId || hasFbClickId) {
    if (matches(VIDEO, source)) return "Paid Video";
    if (matches(SOCIAL, source) || hasFbClickId || medium.includes("social")) return "Paid Social";
    if (matches(SEARCH_ENGINES, source) || hasPaidClickId || medium.includes("search")) return "Paid Search";
    if (matches(SHOPPING, source)) return "Paid Shopping";
    return "Paid Other";
  }

  if (medium === "organic" || (matches(SEARCH_ENGINES, source) && !medium)) return "Organic Search";
  if (matches(VIDEO, source) || medium === "video") return "Organic Video";
  if (matches(SOCIAL, source) || medium === "social" || medium === "social-network" || medium === "sm") return "Organic Social";
  if (medium === "referral" || (!!referrer && !source)) return "Referral";
  if (!source && !medium && !referrer) return "Direct";
  return "Unassigned";
}

export interface DeviceInfo {
  device_type: string | null;
  os: string | null;
  browser: string | null;
}

export function parseUserAgent(ua?: string | null): DeviceInfo {
  if (!ua) return { device_type: null, os: null, browser: null };
  const s = ua.toLowerCase();
  const device_type = /ipad|tablet/.test(s) ? "tablet" : /mobi|android|iphone/.test(s) ? "móvil" : "escritorio";
  const os = /windows/.test(s) ? "Windows"
    : /android/.test(s) ? "Android"
    : /iphone|ipad|ios/.test(s) ? "iOS"
    : /mac os|macintosh/.test(s) ? "macOS"
    : /linux/.test(s) ? "Linux" : null;
  const browser = /edg\//.test(s) ? "Edge"
    : /opr\/|opera/.test(s) ? "Opera"
    : /chrome\//.test(s) && !/edg\//.test(s) ? "Chrome"
    : /firefox/.test(s) ? "Firefox"
    : /safari/.test(s) ? "Safari" : null;
  return { device_type, os, browser };
}

export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
  postal_code: string | null;
  timezone: string | null;
}

const EMPTY_GEO: GeoInfo = { country: null, region: null, city: null, postal_code: null, timezone: null };

/** Resolución IP → ciudad/estado en el servidor (nunca desde el navegador). */
export async function geoFromIp(ip?: string | null): Promise<GeoInfo> {
  if (!ip || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) return EMPTY_GEO;
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { "User-Agent": "walix-crm/1.0" },
    });
    if (!res.ok) return EMPTY_GEO;
    const j = await res.json();
    if (j?.error) return EMPTY_GEO;
    return {
      country: j.country_code ?? null,
      region: j.region ?? null,
      city: j.city ?? null,
      postal_code: j.postal ?? null,
      timezone: j.timezone ?? null,
    };
  } catch (_e) {
    return EMPTY_GEO;
  }
}

export function clientIpFrom(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
}

export function utmsFromUrl(url?: string | null): Partial<RawAttribution> {
  if (!url) return {};
  try {
    const u = new URL(url);
    const g = (k: string) => u.searchParams.get(k);
    return {
      utm_source: g("utm_source"),
      utm_medium: g("utm_medium"),
      utm_campaign: g("utm_campaign"),
      utm_term: g("utm_term"),
      utm_content: g("utm_content"),
      gclid: g("gclid"),
      fbclid: g("fbclid"),
      msclkid: g("msclkid"),
      wbraid: g("wbraid"),
      gbraid: g("gbraid"),
    };
  } catch (_e) {
    return {};
  }
}

export interface BuildRowOptions {
  tenantId: string;
  contactId: string;
  touchType: "first" | "last";
  trackIp: boolean;
  ip?: string | null;
}

/** Construye la fila lista para insertar en contact_attribution. */
export async function buildAttributionRow(raw: RawAttribution, opts: BuildRowOptions) {
  const fromUrl = utmsFromUrl(raw.landing_url);
  const merged: RawAttribution = { ...fromUrl, ...Object.fromEntries(Object.entries(raw).filter(([, v]) => v != null && v !== "")) };
  const geo = opts.trackIp ? await geoFromIp(opts.ip) : EMPTY_GEO;
  const device = parseUserAgent(merged.user_agent);
  let landing_path: string | null = null;
  try { landing_path = merged.landing_url ? new URL(merged.landing_url).pathname : null; } catch (_e) { /* noop */ }

  return {
    tenant_id: opts.tenantId,
    contact_id: opts.contactId,
    touch_type: opts.touchType,
    utm_source: merged.utm_source ?? null,
    utm_medium: merged.utm_medium ?? null,
    utm_campaign: merged.utm_campaign ?? null,
    utm_term: merged.utm_term ?? null,
    utm_content: merged.utm_content ?? null,
    gclid: merged.gclid ?? null,
    fbclid: merged.fbclid ?? null,
    msclkid: merged.msclkid ?? null,
    wbraid: merged.wbraid ?? null,
    gbraid: merged.gbraid ?? null,
    ga_channel: resolveGaChannel(merged),
    referrer: merged.referrer ?? null,
    landing_url: merged.landing_url ?? null,
    landing_path,
    source_kind: merged.source_kind ?? null,
    meta_ad_id: merged.meta_ad_id ?? null,
    meta_adset_id: merged.meta_adset_id ?? null,
    meta_campaign_id: merged.meta_campaign_id ?? null,
    meta_form_id: merged.meta_form_id ?? null,
    meta_platform: merged.meta_platform ?? null,
    ip_address: opts.trackIp ? (opts.ip ?? null) : null,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    postal_code: geo.postal_code,
    timezone: geo.timezone,
    language: merged.language ?? null,
    device_type: device.device_type,
    os: device.os,
    browser: device.browser,
    user_agent: merged.user_agent ?? null,
    touched_at: new Date().toISOString(),
  };
}
