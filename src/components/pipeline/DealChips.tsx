import { useMemo, type ReactNode } from "react";
import { computeDealHealth } from "@/lib/dealHealth";
import type { PipelineDeal } from "@/lib/queries/pipeline";
import { cn } from "@/lib/utils";

export type DealChip = "all" | "risk" | "stale" | "overdue" | "closing" | "won" | "lost";

function parseCalendarDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return new Date(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function useDealChips(
  deals: PipelineDeal[], chip: DealChip, start: Date, end: Date,
  lastActivity: Map<string, string | null>,
) {
  return useMemo(() => {
    const rows = deals.map((d) => ({
      deal: d,
      health: computeDealHealth(d, d.contactId ? lastActivity.get(d.contactId) : null),
    }));
    const closing = (d: PipelineDeal) =>
      !!d.expectedCloseDate && parseCalendarDate(d.expectedCloseDate) >= start && parseCalendarDate(d.expectedCloseDate) < end;
    const tests: Record<DealChip, (r: (typeof rows)[number]) => boolean> = {
      all: () => true,
      won: (r) => r.deal.isWon,
      lost: (r) => r.deal.isLost,
      risk: (r) => r.health.signals.length > 0,
      stale: (r) => r.health.daysInStage > 14,
      overdue: (r) => r.health.isOverdue,
      closing: (r) => closing(r.deal),
    };
    const labels: [DealChip, string][] = [
      ["all", "Todas"], ["won", "Cobradas"], ["lost", "Perdidas"], ["risk", "En riesgo"],
      ["stale", "Estancadas +14d"], ["overdue", "Vencidas"], ["closing", "Cierran en el periodo"],
    ];
    const chips = labels.map(([key, label]) => ({ key, label, count: rows.filter(tests[key]).length }));
    const filtered = rows.filter(tests[chip]).map((r) => r.deal);
    return { chips, filtered };
  }, [deals, chip, start, end, lastActivity]);
}

export function DealChipsRow({
  chips, value, onChange, trailing,
}: {
  chips: { key: DealChip; label: string; count: number }[];
  value: DealChip;
  onChange: (c: DealChip) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-wrap gap-2 flex-1 min-w-0">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            className={cn(
              "text-xs rounded-full border px-2.5 py-1 transition-colors",
              value === c.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground",
            )}
          >
            {c.label} · {c.count}
          </button>
        ))}
      </div>
      {trailing}
    </div>
  );
}
