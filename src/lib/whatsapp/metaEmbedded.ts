import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    FB?: {
      init: (opts: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        cb: (resp: { authResponse?: { code?: string }; status?: string }) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export const PUBLISHED_APP_URL = "https://s1.walix.app";
export const PUBLISHED_APP_DOMAIN = "s1.walix.app";

export function isPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.host;
  return h.includes("lovableproject.com") || h.includes("id-preview--") || h.includes("localhost");
}

export class PreviewHostError extends Error {
  constructor() {
    super(
      `El popup de Meta no funciona desde Preview (${typeof window !== "undefined" ? window.location.host : ""}). Abre la URL publicada para conectar WhatsApp: ${PUBLISHED_APP_URL}/settings?tab=whatsapp`,
    );
    this.name = "PreviewHostError";
  }
}

function buildMissingCodeMessage(appId: string) {
  const currentHost = window.location.host;
  const isPreviewHost = currentHost.includes("lovableproject.com") || currentHost.includes("id-preview--");
  if (isPreviewHost) {
    return `Meta no devolvió código porque el flujo se abrió desde una vista previa (${currentHost}). Prueba desde la URL publicada ${PUBLISHED_APP_URL} y autoriza en Meta el dominio ${PUBLISHED_APP_DOMAIN}.`;
  }
  return `Meta no devolvió código. Verifica que el App ID ${appId} tenga “Inicio de sesión con el SDK para JavaScript” en “Sí” y que el dominio ${currentHost} esté en Allowed domains y Valid OAuth Redirect URIs.`;
}

async function loadConfig() {
  const { data, error } = await supabase.functions.invoke("whatsapp-embedded-config", { method: "GET" });
  if (error) throw new Error("No se pudo cargar la configuración de Meta");
  if (!data?.appId || !data?.configId) throw new Error("META_APP_ID o META_CONFIG_ID no configurados");
  return data;
}

function loadFacebookSdk(appId: string, version: string): Promise<void> {
  // Always re-init to pick up a possibly-changed appId
  return new Promise((resolve, reject) => {
    // Remove any previously injected SDK script so a new appId takes effect
    const existing = document.getElementById("facebook-jssdk");
    if (existing) existing.remove();
    // Drop the global FB so init runs again
    try { delete (window as unknown as { FB?: unknown }).FB; } catch { /* ignore */ }

    window.fbAsyncInit = () => {
      window.FB!.init({ appId, cookie: true, xfbml: false, version });
      resolve();
    };
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => reject(new Error("No se pudo cargar el SDK de Facebook"));
    document.body.appendChild(script);
  });
}

export interface EmbeddedSignupResult {
  code: string;
  phone_number_id: string;
  waba_id: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function launchEmbeddedSignup(): Promise<EmbeddedSignupResult> {
  const cfg = await loadConfig();
  await loadFacebookSdk(cfg.appId, cfg.graphVersion);

  return new Promise<EmbeddedSignupResult>((resolve, reject) => {
    let phoneNumberId: string | null = null;
    let wabaId: string | null = null;
    let settled = false;

    const onMessage = (event: MessageEvent) => {
      if (typeof event.origin !== "string" || !event.origin.includes("facebook.com")) return;
      let payload: unknown = event.data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      if (!isRecord(payload) || payload.type !== "WA_EMBEDDED_SIGNUP") return;
      const data = isRecord(payload.data) ? payload.data : {};
      if (payload.event === "FINISH") {
        phoneNumberId = typeof data.phone_number_id === "string" ? data.phone_number_id : phoneNumberId;
        wabaId = typeof data.waba_id === "string" ? data.waba_id : wabaId;
      }
      if (payload.event === "CANCEL") {
        if (!settled) {
          settled = true;
          window.removeEventListener("message", onMessage);
          reject(new Error("El usuario canceló la conexión."));
        }
      }
    };
    window.addEventListener("message", onMessage);

    window.FB!.login(
      (response) => {
        const code = response?.authResponse?.code;
        // Wait briefly to ensure WA_EMBEDDED_SIGNUP message arrived
        setTimeout(() => {
          window.removeEventListener("message", onMessage);
          if (settled) return;
          settled = true;
        if (!code) {
          return reject(new Error(buildMissingCodeMessage(cfg.appId)));
        }
          if (!phoneNumberId || !wabaId) {
            return reject(new Error("No se recibió número o cuenta de negocio. Reintenta."));
          }
          resolve({ code, phone_number_id: phoneNumberId, waba_id: wabaId });
        }, 400);
      },
      {
        config_id: cfg.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { feature: "whatsapp_embedded_signup", version: 2 },
      },
    );
  });
}