import { useMemo, useState } from "react";
import { ArrowUpDown, CheckCircle2, ChevronDown, ChevronRight, Download, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StageStepper } from "@/components/contacts/detail/StageStepper";
import { effectiveProbability } from "@/lib/pipeline/probability";
import { HealthBadges } from "./HealthBadges";
import { computeDealHealth } from "@/lib/dealHealth";
import { daysSince, formatMXN, type PipelineDeal, type PipelineStage } from "@/lib/queries/pipeline";
import { useProductCategories } from "@/lib/queries/monthlyGoals";
import { frequencyLabel, SERVICE_FREQUENCY_OPTIONS } from "@/lib/serviceFrequency";
import { cn } from "@/lib/utils";

export type PerformanceLens = "created" | "active" | "all";

interface Props {
  deals: PipelineDeal[];
  stages: PipelineStage[];
  /** Todas las etapas del pipeline, incluidas las cerradas (para el filtro de etapa) */
  allStages?: PipelineStage[];
  contactName: (id: string | null) => string | undefined;
  contactLastActivityById: Map<string, string | null>;
  onOpenDeal: (deal: PipelineDeal) => void;
  lens: PerformanceLens;
  onLens: (v: PerformanceLens) => void;
  periodMonth: string; // "YYYY-MM"
  onPeriodMonth: (v: string) => void;
  productIds: string[];
  frequency: string;
  owner: string;
  stageId: string;
}

type SortKey = "name" | "amount" | "stage" | "probability" | "owner" | "days" | "close";
type Chip = "all" | "risk" | "stale" | "overdue" | "closing" | "won" | "lost";

/** Default period value. */
export function currentMonthKey() {
  return "month";
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Database `date` values have no timezone; parse them as local calendar dates. */
function parseCalendarDate(value: string) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!dateOnly) return new Date(value);
  return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
}

/** Resolves a period value ("month" | "prev" | "90d" | "year" | "todo" | "custom:from:to" | legacy "YYYY-MM"). */
export function parsePeriod(value: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const monthLabel = (d: Date) => d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });


  if (value.startsWith("custom:")) {
    const [, from, to] = value.split(":");
    if (from && to) {
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(`${to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      return { start, end, label: `${from} → ${to}` };
    }
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    return { start, end: new Date(y, m, 1), label: monthLabel(start) };
  }
  switch (value) {
    case "prev": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { start, end: new Date(now.getFullYear(), now.getMonth(), 1), label: monthLabel(start) };
    }
    case "90d": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      return { start, end, label: "últimos 90 días" };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear() + 1, 0, 1);
      return { start, end, label: `el año ${now.getFullYear()}` };
    }
    case "todo": {
      // Sin límite práctico de fechas: el lente manda (activas / creadas / todas).
      return { start: new Date(2000, 0, 1), end: new Date(2100, 0, 1), label: "todo el tiempo" };
    }
    default: {

      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1), label: monthLabel(start) };
    }
  }
}

export const PERIOD_PRESETS = [
  { key: "month", label: "Este mes" },
  { key: "prev", label: "Mes anterior" },
  { key: "90d", label: "Últimos 90 días" },
  { key: "year", label: "Todo el año" },
  { key: "todo", label: "Todo" },
  { key: "custom", label: "Personalizado" },
] as const;


/** Deals inside the period according to the lens (closed deals by real close date). */
export function filterPeriodSet(
  deals: PipelineDeal[], lens: PerformanceLens, start: Date, end: Date,
  stageId: string, allStages: PipelineStage[],
) {
  const selected = allStages.find((s) => s.id === stageId);
  const closedSelected = !!selected && (selected.isWon || selected.isLost);
  const dealClosedInPeriod = (d: PipelineDeal) => {
    if (d.isWon && d.wonAt) {
      const w = new Date(d.wonAt);
      return w >= start && w < end;
    }
    if (d.isLost) {
      const u = new Date(d.updatedAt);
      return u >= start && u < end;
    }
    return false;
  };
  return deals.filter((d) => {
    const created = new Date(d.createdAt);
    const closeRef = d.expectedCloseDate ? parseCalendarDate(d.expectedCloseDate) : created;
    const createdIn = created >= start && created < end;
    const closeIn = closeRef >= start && closeRef < end;
    if (d.isWon || d.isLost) {
      if (lens === "all" || closedSelected || lens === "created") return dealClosedInPeriod(d);
      return false;
    }
    if (lens === "created") return createdIn;
    if (lens === "all" || closedSelected) return createdIn || closeIn;
    return closeIn;
  });
}

/** Applies the secondary filters (category, frequency, user, stage). */
export function applySecondaryFilters(
  deals: PipelineDeal[], f: { productIds: string[]; frequency: string; owner: string; stageId: string },
) {
  return deals.filter((d) =>
    (f.productIds.length === 0 || (d.productCategoryId ? f.productIds.includes(d.productCategoryId) : false)) &&
    (f.frequency === "all" || String(d.serviceFrequencyMonths ?? "") === f.frequency) &&
    (f.owner === "all" || d.ownerName === f.owner) &&
    (f.stageId === "all" || d.stageId === f.stageId));
}

export function DealsPerformanceView({
  deals, stages, allStages, contactName, contactLastActivityById, onOpenDeal,
  lens, periodMonth, productIds, frequency, owner, stageId,
}: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "amount", dir: "desc" });
  const [chip, setChip] = useState<Chip>("all");
  const [openStage, setOpenStage] = useState<string | null>(null);

  const { start, end, label: periodLabel } = useMemo(() => parsePeriod(periodMonth), [periodMonth]);
  const periodSet = useMemo(
    () => filterPeriodSet(deals, lens, start, end, stageId, allStages ?? stages),
    [deals, lens, start, end, stageId, allStages, stages],
  );

  const base = useMemo(() => {
    return periodSet.filter((d) =>
      (productIds.length === 0 || (d.productCategoryId ? productIds.includes(d.productCategoryId) : false)) &&
      (frequency === "all" || String(d.serviceFrequencyMonths ?? "") === frequency) &&
      (owner === "all" || d.ownerName === owner) &&
      (stageId === "all" || d.stageId === stageId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodSet, productIds, frequency, owner, stageId]);

  // Frecuencias presentes en el periodo (para no mostrar opciones vacías)
  const frequencyCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of periodSet) {
      if (d.serviceFrequencyMonths) m.set(d.serviceFrequencyMonths, (m.get(d.serviceFrequencyMonths) ?? 0) + 1);
    }
    return m;
  }, [periodSet]);

  // Category counts within the period (so it is obvious where the deals are)
  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    let none = 0;
    for (const d of periodSet) {
      if (d.productCategoryId) m.set(d.productCategoryId, (m.get(d.productCategoryId) ?? 0) + 1);
      else none += 1;
    }
    return { m, none };
  }, [periodSet]);

  const ownerNames = useMemo(
    () => Array.from(new Set(deals.map((d) => d.ownerName).filter(Boolean))).sort(),
    [deals],
  );

  // Deals closed (won/lost) inside the period — shown apart, never in the open pipeline
  const closedInPeriod = useMemo(
    () => deals.filter((d) => {
      if (d.isWon && d.wonAt) {
        const w = new Date(d.wonAt);
        return w >= start && w < end;
      }
      if (d.isLost) {
        const u = new Date(d.updatedAt);
        return u >= start && u < end;
      }
      return false;
    }),
    [deals, start, end],
  );

  const rows = useMemo(() => {
    return base.map((d) => ({
      deal: d,
      health: computeDealHealth(d, d.contactId ? contactLastActivityById.get(d.contactId) : null),
    }));
  }, [base, contactLastActivityById]);

  const closingInPeriod = (d: PipelineDeal) =>
    !!d.expectedCloseDate && parseCalendarDate(d.expectedCloseDate) >= start && parseCalendarDate(d.expectedCloseDate) < end;

  const chipped = useMemo(() => {
    switch (chip) {
      case "risk": return rows.filter((r) => r.health.signals.length > 0);
      case "stale": return rows.filter((r) => r.health.daysInStage > 14);
      case "overdue": return rows.filter((r) => r.health.isOverdue);
      case "closing": return rows.filter((r) => closingInPeriod(r.deal));
      case "won": return rows.filter((r) => r.deal.isWon);
      case "lost": return rows.filter((r) => r.deal.isLost);
      default: return rows;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, chip, start, end]);

  const sorted = useMemo(() => {
    const arr = [...chipped];
    arr.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "name": return a.deal.name.localeCompare(b.deal.name) * dir;
        case "amount": return (a.deal.amount - b.deal.amount) * dir;
        case "stage": return a.deal.stageName.localeCompare(b.deal.stageName) * dir;
        case "probability": return (a.deal.probability - b.deal.probability) * dir;
        case "owner": return a.deal.ownerName.localeCompare(b.deal.ownerName) * dir;
        case "days": return (a.health.daysInStage - b.health.daysInStage) * dir;
        case "close": return ((a.deal.expectedCloseDate ?? "") > (b.deal.expectedCloseDate ?? "") ? 1 : -1) * dir;
      }
    });
    return arr;
  }, [chipped, sort]);

  // Summary over the lens set (not the chip filter)
  const totalAmount = rows.reduce((s, r) => s + r.deal.amount, 0);
  const weighted = rows.reduce((s, r) => s + (r.deal.amount * r.deal.probability) / 100, 0);
  const riskCount = rows.filter((r) => r.health.signals.length > 0).length;
  const staleCount = rows.filter((r) => r.health.daysInStage > 14).length;
  const overdueCount = rows.filter((r) => r.health.isOverdue).length;
  const avgDays = rows.length ? Math.round(rows.reduce((s, r) => s + r.health.daysInStage, 0) / rows.length) : 0;
  const wonAmount = closedInPeriod.filter((d) => d.isWon).reduce((s, d) => s + d.amount, 0);

  // Funnel: progression through open stages
  const funnel = useMemo(() => {
    const ordered = [...stages].sort((a, b) => a.position - b.position);
    const idx = new Map(ordered.map((s, i) => [s.id, i]));
    const base = ordered.map((s, i) => {
      const reached = rows.filter((r) => {
        const di = r.deal.stageId ? idx.get(r.deal.stageId) : undefined;
        return di !== undefined && di >= i;
      });
      const bySeller = new Map<string, { count: number; amount: number }>();
      for (const r of reached) {
        const key = r.deal.ownerName || "Sin asignar";
        const cur = bySeller.get(key) ?? { count: 0, amount: 0 };
        bySeller.set(key, { count: cur.count + 1, amount: cur.amount + r.deal.amount });
      }
      return {
        stage: s,
        count: reached.length,
        amount: reached.reduce((sum, r) => sum + r.deal.amount, 0),
        here: rows.filter((r) => r.deal.stageId === s.id).length,
        sellers: Array.from(bySeller.entries())
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.count - a.count),
      };
    });
    return base.map((f, i) => {
      const prev = i === 0 ? f.count : base[i - 1].count;
      return {
        ...f,
        stepPct: i === 0 ? 100 : prev > 0 ? Math.round((f.count / prev) * 100) : 0,
        totalPct: base[0]?.count ? Math.round((f.count / base[0].count) * 100) : 0,
      };
    });
  }, [rows, stages]);
  const funnelTop = funnel[0]?.count ?? 0;
  const funnelEnd = funnel.length ? funnel[funnel.length - 1].count : 0;
  const funnelConversionPct = funnelTop ? Math.round((funnelEnd / funnelTop) * 100) : 0;

  // Matriz por vendedor: filas = vendedor, columnas = etapas alcanzadas
  const sellerMatrix = useMemo(() => {
    const ordered = [...stages].sort((a, b) => a.position - b.position);
    const idx = new Map(ordered.map((s, i) => [s.id, i]));
    const bySeller = new Map<string, PipelineDeal[]>();
    for (const r of rows) {
      const key = r.deal.ownerName || "Sin asignar";
      const arr = bySeller.get(key) ?? [];
      arr.push(r.deal);
      bySeller.set(key, arr);
    }
    return Array.from(bySeller.entries())
      .map(([name, ds]) => {
        const cells = ordered.map((_, i) => {
          const count = ds.filter((d) => {
            const di = d.stageId ? idx.get(d.stageId) : undefined;
            return di !== undefined && di >= i;
          }).length;
          return count;
        });
        const top = cells[0] ?? 0;
        return {
          name,
          total: ds.length,
          amount: ds.reduce((s, d) => s + d.amount, 0),
          cells: cells.map((c) => ({ count: c, pct: top ? Math.round((c / top) * 100) : 0 })),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [rows, stages]);

  function toggle(k: SortKey) {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" }));
  }

  function exportCsv() {
    const headers = ["Deal", "Contacto", "Monto MXN", "Etapa", "Probabilidad", "Vendedor", "Días en etapa", "Días sin actividad", "Salud", "Fecha cierre"];
    const rowsCsv = sorted.map(({ deal: d, health }) => [
      d.name,
      contactName(d.contactId) ?? "",
      d.amount.toString(),
      d.stageName,
      `${d.probability}%`,
      d.ownerName,
      health.daysInStage.toString(),
      health.daysSinceContactActivity?.toString() ?? "",
      health.signals.join(" / "),
      d.expectedCloseDate ?? "",
    ]);
    const meta = [[`Lente: ${lens === "created" ? "Creadas en el periodo" : lens === "all" ? "Todas del periodo" : "Activas en el periodo"}`], [`Periodo: ${periodLabel}`], []];
    const csv = [...meta, headers, ...rowsCsv]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-desempeno-${periodMonth.replace(/[:]/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => toggle(k)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
      {label} <ArrowUpDown className={cn("h-3 w-3", sort.key === k ? "text-primary" : "text-muted-foreground/60")} />
    </button>
  );

  const chips: { key: Chip; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: rows.length },
    { key: "won", label: "Cobradas", count: rows.filter((r) => r.deal.isWon).length },
    { key: "lost", label: "Perdidas", count: rows.filter((r) => r.deal.isLost).length },
    { key: "risk", label: "En riesgo", count: riskCount },
    { key: "stale", label: "Estancadas +14d", count: staleCount },
    { key: "overdue", label: "Vencidas", count: overdueCount },
    { key: "closing", label: "Cierran en el periodo", count: rows.filter((r) => closingInPeriod(r.deal)).length },
  ];

  return (
    <div className="space-y-3">

      {/* Funnel */}
      {funnelTop > 0 && (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold">Embudo de avance</h3>
          <span className="text-[11px] font-semibold rounded-full border border-primary/30 bg-primary/10 text-primary px-2 py-0.5">
            Conversión total {funnelConversionPct}%
          </span>
        </div>
        {(
          <>
            <div className="flex items-stretch gap-1 w-full">
              {funnel.map((f, i) => {
                const color = `hsl(var(--funnel-${(i % 6) + 1}))`;
                return (
                  <div key={f.stage.id} className="flex-1 min-w-0 flex items-center gap-1">
                    {i > 0 && (
                      <div className="flex items-center text-muted-foreground text-[10px] font-semibold shrink-0">
                        <ChevronRight className="h-3.5 w-3.5" />
                        {f.stepPct}%
                      </div>
                    )}
                    <button
                      onClick={() => setOpenStage(openStage ? null : "matrix")}
                      className="flex-1 min-w-0 text-left rounded-lg border px-2 py-1 transition-opacity hover:opacity-80"
                      style={{ borderColor: color, backgroundColor: `hsl(var(--funnel-${(i % 6) + 1}) / 0.12)` }}
                      title="Ver desglose por vendedor"
                    >
                      <div className="text-[10px] truncate font-medium" style={{ color }}>{f.stage.name}</div>
                      <div className="text-base font-bold leading-none">{f.count}</div>
                      <div className="text-[9px] text-muted-foreground">{f.totalPct}% del inicio</div>
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              className="text-[11px] text-primary hover:underline mt-2"
              onClick={() => setOpenStage(openStage ? null : "matrix")}
            >
              {openStage ? "Ocultar desglose por vendedor" : "Ver desglose por vendedor"}
            </button>
            {openStage && (
              <div className="mt-3 rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-medium px-3 py-2">Vendedor</th>
                      {funnel.map((f, i) => (
                        <th
                          key={f.stage.id}
                          className="text-right font-medium px-3 py-2 whitespace-nowrap"
                          style={{ color: `hsl(var(--funnel-${(i % 6) + 1}))` }}
                        >
                          {f.stage.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sellerMatrix.map((s) => (
                      <tr key={s.name} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-[10px] text-muted-foreground">{formatMXN(s.amount)}</div>
                        </td>
                        {s.cells.map((c, i) => (
                          <td key={i} className="px-3 py-2 text-right whitespace-nowrap">
                            <span className="font-semibold">{c.count}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">({c.pct}%)</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                    {sellerMatrix.length === 0 && (
                      <tr>
                        <td colSpan={funnel.length + 1} className="px-3 py-4 text-center text-muted-foreground">
                          Sin datos por vendedor.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* Chips */}
      <div className="flex items-start gap-2">
      <div className="flex flex-wrap gap-2 flex-1">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setChip(c.key)}
            className={cn(
              "text-xs rounded-full border px-2.5 py-1 transition-colors",
              chip === c.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground",
            )}
          >
            {c.label} · {c.count}
          </button>
        ))}
      </div>
        <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={exportCsv} title="Exportar CSV" aria-label="Exportar CSV">
          <Download className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortBtn k="name" label="Oportunidad" /></TableHead>
              <TableHead className="text-right"><SortBtn k="amount" label="Monto" /></TableHead>
              <TableHead><SortBtn k="probability" label="Prob." /></TableHead>
              <TableHead className="min-w-[160px]"><SortBtn k="stage" label="Etapa" /></TableHead>
              <TableHead><SortBtn k="days" label="Días" /></TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Salud</TableHead>
              <TableHead><SortBtn k="owner" label="Vendedor" /></TableHead>
              <TableHead><SortBtn k="close" label="Cierre" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(({ deal: d, health }) => (
              <TableRow key={d.id} className="cursor-pointer" onClick={() => onOpenDeal(d)}>
                <TableCell>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="truncate">{contactName(d.contactId) ?? "Sin contacto"}</span>
                    {d.serviceFrequencyMonths && (
                      <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] leading-none">
                        {frequencyLabel(d.serviceFrequencyMonths)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold text-success">{formatMXN(d.amount)}</TableCell>
                <TableCell className={cn("text-sm", d.isWon && "text-success font-medium", d.isLost && "text-destructive")}>
                  {effectiveProbability(d)}%
                </TableCell>
                <TableCell className="min-w-[160px]">
                  <StageStepper stages={stages} currentStageId={d.stageId} isWon={d.isWon} isLost={d.isLost} stageName={d.stageName} />
                </TableCell>
                <TableCell className="text-xs">
                  <div>{health.daysInStage}d en etapa</div>
                  <div className="text-muted-foreground">
                    {health.daysSinceContactActivity === null ? "Sin actividad" : `${health.daysSinceContactActivity}d sin contacto`}
                  </div>
                </TableCell>
                <TableCell>
                  {d.isWon ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success text-[10px] font-medium px-2 py-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Ganado
                    </span>
                  ) : d.isLost ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground text-[10px] font-medium px-2 py-0.5">
                      <XCircle className="h-3 w-3" /> Perdido
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-border text-[10px] text-muted-foreground px-2 py-0.5">Activa</span>
                  )}
                </TableCell>
                <TableCell><HealthBadges health={health} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[9px] text-white" style={{ backgroundColor: d.ownerColor }}>
                        {d.ownerInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{d.ownerName}</span>
                  </div>
                </TableCell>
                <TableCell className={cn("text-sm", health.isOverdue && "text-destructive font-medium")}>
                  {d.expectedCloseDate ? parseCalendarDate(d.expectedCloseDate).toLocaleDateString("es-MX") : "—"}
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-10">
                  {periodLabel === "todo el tiempo" ? "Sin oportunidades para este lente." : "Sin oportunidades para este periodo y lente."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCell label="Oportunidades" value={String(rows.length)} />
        <SummaryCell label="Monto total" value={formatMXN(totalAmount)} tone="success" />
        <SummaryCell label="Ponderado" value={formatMXN(weighted)} />
        <SummaryCell label="En riesgo" value={String(riskCount)} tone={riskCount ? "warning" : undefined} />
        <SummaryCell label="Vencidas" value={String(overdueCount)} tone={overdueCount ? "danger" : undefined} />
        <SummaryCell label="Días prom. en etapa" value={`${avgDays}d`} />
      </div>

      {closedInPeriod.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Aparte: {closedInPeriod.length} oportunidad{closedInPeriod.length === 1 ? "" : "es"} cerrada{closedInPeriod.length === 1 ? "" : "s"} en {periodLabel}
          {wonAmount > 0 ? ` · ${formatMXN(wonAmount)} ganados` : ""}.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {periodLabel === "todo el tiempo"
          ? lens === "created"
            ? "Todas las oportunidades creadas desde el inicio, sin importar cuándo cierren."
            : lens === "all"
              ? "Todas las oportunidades históricas: abiertas, ganadas y perdidas."
              : "Todas las oportunidades abiertas de la empresa, sin importar cuándo entraron."
          : lens === "created"
          ? `Oportunidades creadas en ${periodLabel}, sin importar cuándo cierren.`
          : lens === "all"
            ? `Todas las oportunidades relacionadas con ${periodLabel}: creadas, con cierre esperado o cerradas en el periodo (abiertas y cerradas).`
            : `Oportunidades abiertas con cierre esperado dentro de ${periodLabel}.`}
        {" "}La salud se calcula al día de hoy.
      </p>

    </div>
  );
}

function SummaryCell({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-lg font-bold tracking-tight",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}
