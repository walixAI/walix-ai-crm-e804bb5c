import { useEffect } from "react";
import { toast } from "sonner";
import { useMyProfile } from "@/lib/queries/profile";
import { useClientsChannelReady } from "@/lib/queries/whatsappChannels";

/**
 * La mensajería de WhatsApp con clientes depende de que el Tenant tenga
 * un canal propio conectado. En cuanto lo conecta, se habilita solo.
 */
export const WHATSAPP_DISABLED_REASON =
  "Tu WhatsApp Business aún no está conectado: se abrirá WhatsApp Web. Conéctalo en Configuración → WhatsApp para conversar desde Walix.";

let cachedEnabled = false;

/** Estado actual (para handlers imperativos). */
export function isWhatsappChatEnabled(): boolean {
  return cachedEnabled;
}

/** Hook reactivo: true si el tenant tiene canal de clientes conectado. */
export function useWhatsappChatEnabled(): boolean {
  const { data: profile } = useMyProfile();
  const tenantId = (profile as any)?.tenant_id ?? null;
  const { data: ready } = useClientsChannelReady(tenantId);
  const enabled = ready === true;
  useEffect(() => { cachedEnabled = enabled; }, [enabled]);
  return enabled;
}

/** Abre WhatsApp Web/app con el número del contacto (fallback sin canal propio). */
export function openWhatsappWeb(phone?: string | null, text?: string): void {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) {
    toast.info("Este contacto no tiene teléfono registrado.");
    return;
  }
  const url = `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Devuelve true si el flujo interno de Walix no aplica.
 * Sin canal propio conectado, abre WhatsApp Web con el número del contacto.
 */
export function blockWhatsappAction(phone?: string | null, text?: string): boolean {
  if (cachedEnabled) return false;
  if (phone === undefined) toast.info(WHATSAPP_DISABLED_REASON);
  else openWhatsappWeb(phone, text);
  return true;
}
