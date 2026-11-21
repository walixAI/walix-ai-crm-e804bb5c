/** Advisors that must not be rung: paused/offline, or available with a stale browser heartbeat. */
export const AGENT_STALE_MS = 3 * 60_000;
export function unavailableAgents(rows: { user_id: string; kind: string; last_seen_at: string }[], now: number): Set<string> {
  return new Set(rows.filter((r) => r.kind !== "available" || now - new Date(r.last_seen_at).getTime() > AGENT_STALE_MS).map((r) => r.user_id));
}
