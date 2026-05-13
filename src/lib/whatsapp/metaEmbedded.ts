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

let cachedConfig: { appId: string; configId: string; graphVersion: string } | null = null;
let sdkLoadingPromise: Promise<void> | null = null;

async function loadConfig() {
  if (cachedConfig) return cachedConfig;
  const { data, error } = await supabase.functions.invoke("whatsapp-embedded-config", { method: "GET" });
  if (error) throw new Error("No se pudo cargar la configuración de Meta");
  if (!data?.appId || !data?.configId) throw new Error("META_APP_ID o META_CONFIG_ID no configurados");
  cachedConfig = data;
  return data;
}

function loadFacebookSdk(appId: string, version: string): Promise<void> {
  if (window.FB) return Promise.resolve();
  if (sdkLoadingPromise) return sdkLoadingPromise;
  sdkLoadingPromise = new Promise((resolve, reject) => {
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
  return sdkLoadingPromise;
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
          return reject(new Error(
            `Meta no devolvió código. Verifica que el App ID ${cfg.appId} tenga “Inicio de sesión con el SDK para JavaScript” en “Sí” y que el dominio ${window.location.host} esté permitido para el SDK.`,
          ));
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