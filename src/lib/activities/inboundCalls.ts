export interface InboundCallRecord {
  direction: string;
  status: string;
  answered_at?: string | null;
  metadata?: unknown;
}

/** A provider greeting or voicemail does not mean an advisor answered. */
export function isMissedInbound(call: InboundCallRecord): boolean {
  if (call.direction !== "inbound" || call.answered_at) return false;
  return ["no_answer", "busy", "failed", "voicemail", "completed"].includes(call.status);
}