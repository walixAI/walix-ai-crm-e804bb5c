export type HangupBy = "prospect" | "agent" | "system";

export interface HangupEvidence {
  hangup_by?: string | null;
  hangup_at?: string | null;
}

/** A completed callback identifies an end, not which party initiated it. */
export function terminalHangup(status: string, now: string, existing: HangupEvidence = {}): HangupEvidence {
  if (!["completed", "failed", "no_answer", "busy", "voicemail"].includes(status)) return {};
  return {
    ...(existing.hangup_at ? {} : { hangup_at: now }),
    ...(!existing.hangup_by && ["failed", "busy"].includes(status) ? { hangup_by: "system" } : {}),
  };
}

/**
 * Twilio <Dial> action: if the parent (caller) leg is already completed the prospect hung up;
 * if it is still in progress the advisor leg ended it. Unanswered dials end by timeout (system).
 */
export function inboundDialHangup(status: string, parentStatus: string, existing?: string | null): HangupEvidence {
  if (existing) return {};
  if (status === "completed") return { hangup_by: parentStatus === "completed" ? "prospect" : "agent" };
  if (status === "no_answer") return { hangup_by: parentStatus === "completed" ? "prospect" : "system" };
  return {};
}

/** Outbound <Dial> action: parent leg is the advisor; a completed parent means the advisor hung up. */
export function outboundDialHangup(status: string, parentStatus: string, existing?: string | null): HangupEvidence {
  if (existing) return {};
  if (status === "completed") return { hangup_by: parentStatus === "completed" ? "agent" : "prospect" };
  if (status === "no_answer") return { hangup_by: parentStatus === "completed" ? "agent" : "system" };
  return {};
}

export function hangupLabel(by?: string | null): string {
  switch (by) {
    case "prospect": return "Colgó el prospecto";
    case "agent": return "Colgó el asesor";
    case "system": return "Finalizó el sistema";
    default: return "No registrado";
  }
}