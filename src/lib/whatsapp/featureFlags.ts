import { useEffect } from "react";
import { toast } from "sonner";
import { useMyProfile } from "@/lib/queries/profile";
import { useClientsChannelReady } from "@/lib/queries/whatsappChannels";

/**
 * La mensajería de WhatsApp con clientes depende de que el Tenant tenga
 * un canal propio conectado. En cuanto lo conecta, se habilita solo.
 */
export const WHATSAPP_DISABLED_REASON =
  "Tu WhatsApp Business aún no está conectado. Conéctalo en Configuración → WhatsApp para conversar con clientes.";

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

/** Devuelve true si la acción quedó bloqueada (y avisa al usuario). */
export function blockWhatsappAction(): boolean {
  if (cachedEnabled) return false;
  toast.info(WHATSAPP_DISABLED_REASON);
  return true;
}
