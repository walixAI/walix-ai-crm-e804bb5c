export const SERVICE_FREQUENCY_OPTIONS = [
  { months: 6, label: "Semestral", short: "6M" },
  { months: 12, label: "Anual", short: "12M" },
  { months: 3, label: "Trimestral", short: "3M" },
  { months: 1, label: "Mensual", short: "1M" },
  { months: 24, label: "Bienal", short: "24M" },
] as const;

export function frequencyLabel(months?: number | null): string | null {
  if (!months) return null;
  return SERVICE_FREQUENCY_OPTIONS.find((o) => o.months === months)?.label ?? `Cada ${months} meses`;
}

export function frequencyShort(months?: number | null): string | null {
  if (!months) return null;
  return SERVICE_FREQUENCY_OPTIONS.find((o) => o.months === months)?.short ?? `${months}M`;
}
