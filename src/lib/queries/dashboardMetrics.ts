type DealMetric = { amount: number | string | null; is_won: boolean; is_lost: boolean; won_at: string | null; lost_at: string | null };
export function dashboardMetrics(deals: DealMetric[], now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rate = (from: Date, to: Date) => {
    const closed = deals.filter((d) => {
      const date = d.is_won ? d.won_at : d.is_lost ? d.lost_at : null;
      return date && new Date(date) >= from && new Date(date) < to;
    });
    return { count: closed.length, value: closed.length ? Math.round(closed.filter((d) => d.is_won).length / closed.length * 100) : 0 };
  };
  const current = rate(start, new Date(now.getTime() + 1));
  const before = rate(previous, start);
  return {
    pipelineValue: deals.filter((d) => !d.is_won && !d.is_lost).reduce((sum, d) => sum + Number(d.amount ?? 0), 0),
    // Historical open amounts are not stored: never fabricate yesterday's value.
    pipelineDeltaPct: null,
    closeRate: current.value,
    closeRateDelta: current.count && before.count ? current.value - before.value : null,
  };
}