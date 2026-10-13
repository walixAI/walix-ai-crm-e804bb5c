/** The newest created open opportunity is the contact's current commercial context. */
export function latestActiveOpportunity<T extends { isWon: boolean; isLost: boolean; createdAt: string }>(deals: T[]): T | null {
  return deals.filter(d => !d.isWon && !d.isLost)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}