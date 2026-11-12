import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export type PeriodPreset = "today" | "week" | "month" | "quarter" | "custom";

export interface PeriodValue {
  preset: PeriodPreset;
  from?: string; // ISO date
  to?: string;   // ISO date
}

export interface ReportFilters {
  period: PeriodValue;
  sellers: string[]; // empty = all; UUIDs of profiles.id
}

const STORAGE_KEY = "walix.reports.filters.v1";

const DEFAULT: ReportFilters = {
  period: { preset: "month" },
  sellers: [],
};

export function periodLabel(p: PeriodValue): string {
  switch (p.preset) {
    case "today":   return "Hoy";
    case "week":    return "Esta semana";
    case "month":   return "Este mes";
    case "quarter": return "Últimos 3 meses";
    case "custom":  return p.from && p.to ? `${p.from} → ${p.to}` : "Personalizado";
  }
}

export function useReportFilters() {
  const { user, activeTenantId } = useAuth();
  const storageKey = `${STORAGE_KEY}:${user?.id ?? "signed-out"}:${activeTenantId ?? "none"}`;
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT);

  // Load persisted filters
  useEffect(() => {
    setFilters(DEFAULT);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ReportFilters>;
        if (parsed.period) {
          setFilters({
            period: parsed.period,
            sellers: Array.isArray(parsed.sellers) ? parsed.sellers : [],
          });
        }
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  const update = useCallback((next: Partial<ReportFilters>) => {
    setFilters(prev => {
      const merged = { ...prev, ...next };
      try { localStorage.setItem(storageKey, JSON.stringify(merged)); } catch { /* ignore */ }
      return merged;
    });
  }, [storageKey]);

  const setPeriod = useCallback((period: PeriodValue) => update({ period }), [update]);
  const setSellers = useCallback((sellers: string[]) => update({ sellers }), [update]);

  return { filters, setPeriod, setSellers };
}