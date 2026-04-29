import { toast as sonner } from "sonner";

/** Helpers estandarizados para toasts en Walix.
 *  Usa sonner bajo el capó. Mantén los mensajes en español, cortos y accionables.
 */

export const toastSuccess = (title: string, description?: string) =>
  sonner.success(title, { description });

export const toastError = (title: string, description?: string) =>
  sonner.error(title, { description });

export const toastWarning = (title: string, description?: string) =>
  sonner.warning(title, { description });

export const toastInfo = (title: string, description?: string) =>
  sonner(title, { description });

export { sonner as toast };