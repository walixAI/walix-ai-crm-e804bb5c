/**
 * WhatsApp conversations mirrored into activities store a transcript ("Autor: texto" per line).
 * In timelines we only show who wrote, never the full conversation.
 */
export function summarizeWaActivity(description: string | null | undefined, metadata: any): string | null {
  if (!metadata?.auto_wa) return null;
  const counts = new Map<string, number>();
  for (const line of (description ?? "").split("\n")) {
    const m = line.match(/^([^:]{1,60}):\s/);
    if (!m) continue;
    const who = m[1].trim();
    counts.set(who, (counts.get(who) ?? 0) + 1);
  }
  if (counts.size === 0) return metadata.direction === "in" ? "Mensaje entrante (Lead)" : "Mensaje saliente";
  return Array.from(counts.entries())
    .map(([who, n]) => {
      const label = who.toLowerCase() === "lead" ? "Mensaje entrante (Lead)" : `Mensaje saliente (${who})`;
      return n > 1 ? `${label} ×${n}` : label;
    })
    .join(" · ");
}
