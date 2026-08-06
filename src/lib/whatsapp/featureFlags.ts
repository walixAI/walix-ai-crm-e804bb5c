import { toast } from "sonner";

/**
 * Interruptor global de la mensajería por WhatsApp.
 * Mientras esté en false, todos los botones y accesos para conversar por
 * WhatsApp quedan inhabilitados en la app (el módulo sigue existiendo,
 * pero no permite abrir ni enviar conversaciones).
 */
export const WHATSAPP_CHAT_ENABLED = false;

export const WHATSAPP_DISABLED_REASON =
  "La mensajería por WhatsApp está inhabilitada temporalmente.";

/** Devuelve true si la acción quedó bloqueada (y avisa al usuario). */
export function blockWhatsappAction(): boolean {
  if (WHATSAPP_CHAT_ENABLED) return false;
  toast.info(WHATSAPP_DISABLED_REASON);
  return true;
}
