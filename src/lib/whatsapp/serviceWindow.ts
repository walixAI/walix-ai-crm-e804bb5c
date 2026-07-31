/**
 * Ventana de servicio de WhatsApp Business (24 h).
 *
 * Meta permite enviar mensajes de texto libres sin costo adicional de plantilla
 * durante las 24 h posteriores al último mensaje ENTRANTE del cliente.
 * Fuera de esa ventana solo se pueden enviar plantillas aprobadas, que se cobran.
 */
export interface ServiceWindow {
  open: boolean;
  hoursLeft: number;
  /** Etiqueta corta para chips en listas. */
  shortLabel: string;
  /** Explicación para el usuario. */
  description: string;
  tone: "open" | "closing" | "closed";
}

export function getServiceWindow(lastInboundAt: string | null | undefined): ServiceWindow {
  if (!lastInboundAt) {
    return {
      open: false,
      hoursLeft: 0,
      shortLabel: "Con costo",
      description:
        "No hay mensajes del cliente. Solo puedes iniciar con una plantilla aprobada y Meta te la cobrará.",
      tone: "closed",
    };
  }
  const elapsedH = (Date.now() - new Date(lastInboundAt).getTime()) / 3_600_000;
  const hoursLeft = Math.max(0, 24 - elapsedH);
  if (hoursLeft <= 0) {
    return {
      open: false,
      hoursLeft: 0,
      shortLabel: "Con costo",
      description:
        "La ventana de 24 h se cerró. Enviar ahora requiere una plantilla aprobada y Meta la cobra.",
      tone: "closed",
    };
  }
  const left = hoursLeft >= 1 ? `${Math.floor(hoursLeft)} h` : `${Math.max(1, Math.round(hoursLeft * 60))} min`;
  return {
    open: true,
    hoursLeft,
    shortLabel: `Gratis ${left}`,
    description: `Conversación activa: puedes responder libre de costo durante ${left} más.`,
    tone: hoursLeft <= 2 ? "closing" : "open",
  };
}
