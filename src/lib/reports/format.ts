export function formatMXN(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatCompactMXN(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function formatPct(n: number, fractionDigits = 0): string {
  return `${n.toFixed(fractionDigits)}%`;
}

export function formatDelta(n: number): { label: string; tone: "positive" | "negative" | "neutral" } {
  if (n === 0) return { label: "0%", tone: "neutral" };
  const sign = n > 0 ? "+" : "";
  return { label: `${sign}${n}%`, tone: n > 0 ? "positive" : "negative" };
}

/** "delta" for time metrics: a negative delta is GOOD (faster). */
export function formatTimeDelta(n: number): { label: string; tone: "positive" | "negative" | "neutral" } {
  if (n === 0) return { label: "0%", tone: "neutral" };
  const sign = n > 0 ? "+" : "";
  return { label: `${sign}${n}%`, tone: n < 0 ? "positive" : "negative" };
}