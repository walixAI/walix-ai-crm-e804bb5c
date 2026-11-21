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

export function hangupLabel(by?: string | null): string {
  switch (by) {
    case "prospect": return "Colgó el prospecto";
    case "agent": return "Colgó el asesor";
    case "system": return "Finalizó el sistema";
    default: return "No registrado";
  }
}