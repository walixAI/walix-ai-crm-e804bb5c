/** Probabilidad efectiva de cierre: 100% si está ganado, 0% si está perdido. */
export function effectiveProbability(deal: { probability?: number | null; isWon?: boolean | null; isLost?: boolean | null }): number {
  if (deal.isWon) return 100;
  if (deal.isLost) return 0;
  const p = deal.probability ?? 0;
  return Math.max(0, Math.min(100, Math.round(p)));
}

/** Texto explicativo para la probabilidad de cierre. */
export function probabilityLabel(deal: { probability?: number | null; isWon?: boolean | null; isLost?: boolean | null }): string {
  if (deal.isWon) return "Ganada · 100%";
  if (deal.isLost) return "Perdida · 0%";
  return `${effectiveProbability(deal)}% prob. de cierre`;
}
