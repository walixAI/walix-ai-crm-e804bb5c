/**
 * Guía contextual del inbox: qué debe hacer el usuario en esta conversación.
 * Nunca dispara acciones; sólo describe el siguiente paso sugerido.
 */
export type GuidanceState = "awaiting_reply" | "follow_up" | "needs_template";

export interface Guidance {
  state: GuidanceState;
  /** Título de la tarjeta lateral. */
  title: string;
  /** Pasos sugeridos. */
  steps: string[];
  /** Texto del CTA principal (siempre pide sugerencia a la IA). */
  ctaLabel: string;
  /** Pista corta junto al botón del composer. */
  hint: string;
  /** Texto del tooltip del botón "Sugerir respuesta". */
  tooltip: string;
  /** Mostrar también el atajo a plantillas aprobadas. */
  showTemplates: boolean;
}

export function getGuidance(params: {
  lastDirection: "inbound" | "outbound" | null;
  hasInbound: boolean;
  windowOpen: boolean;
}): Guidance {
  const { lastDirection, hasInbound, windowOpen } = params;

  if (lastDirection === "inbound" && windowOpen) {
    return {
      state: "awaiting_reply",
      title: "El cliente espera respuesta",
      steps: [
        'Haz clic en "Sugerir respuesta".',
        "Revisa y edita el borrador que redacta la IA.",
        "Presiona enviar cuando estés conforme.",
      ],
      ctaLabel: "Sugerir respuesta",
      hint: "← Haz clic: la IA redacta, tú decides si se envía.",
      tooltip:
        "El cliente escribió. Haz clic aquí: la IA redacta un borrador, tú lo revisas y decides si se envía.",
      showTemplates: false,
    };
  }

  if (!hasInbound || !windowOpen) {
    return {
      state: "needs_template",
      title: hasInbound ? "Ventana de 24 h cerrada" : "Inicia la conversación",
      steps: [
        "Usa una plantilla aprobada (Meta la cobra), o",
        'pide a la IA un borrador con "Redactar con IA".',
        "Revisa el texto y envíalo tú mismo.",
      ],
      ctaLabel: "Redactar con IA",
      hint: "La IA puede redactar el primer mensaje.",
      tooltip:
        "Fuera de la ventana de 24 h. La IA puede redactar el texto; recuerda que el envío requiere plantilla aprobada y tiene costo.",
      showTemplates: true,
    };
  }

  return {
    state: "follow_up",
    title: "Sin respuesta del cliente",
    steps: [
      "Tú fuiste el último en escribir.",
      'Pide un seguimiento con "Redactar seguimiento".',
      "Revisa el borrador y envíalo cuando quieras.",
    ],
    ctaLabel: "Redactar seguimiento",
    hint: "La IA puede redactar el seguimiento.",
    tooltip:
      "Aún no responde. La IA puede redactar un seguimiento; tú lo revisas y decides si se envía.",
    showTemplates: false,
  };
}