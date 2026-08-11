import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronRight, Download, Search } from "lucide-react";
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
import { HealthBadges } from "./HealthBadges";
import { computeDealHealth } from "@/lib/dealHealth";
import { daysSince, formatMXN, type PipelineDeal, type PipelineStage } from "@/lib/queries/pipeline";
import { useProductCategories } from "@/lib/queries/monthlyGoals";
import { cn } from "@/lib/utils";

export type PerformanceLens = "created" | "active" | "all";

interface Props {
  deals: PipelineDeal[];
  stages: PipelineStage[];
  contactName: (id: string | null) => string | undefined;
  contactLastActivityById: Map<string, string | null>;
  onOpenDeal: (deal: PipelineDeal) => void;
  lens: PerformanceLens;
  onLens: (v: PerformanceLens) => void;
  periodMonth: string; // "YYYY-MM"
  onPeriodMonth: (v: string) => void;
}

type SortKey = "name" | "amount" | "stage" | "probability" | "owner" | "days" | "close";
type Chip = "all" | "risk" | "stale" | "overdue" | "closing";

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

/** Resolves a period value ("month" | "prev" | "90d" | "year" | "custom:from:to" | legacy "YYYY-MM"). */
function parsePeriod(value: string): { start: Date; end: Date; label: string } {
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
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1), label: monthLabel(start) };
    }
  }
}

const PERIOD_PRESETS = [
  { key: "month", label: "Este mes" },
  { key: "prev", label: "Mes anterior" },
  { key: "90d", label: "Últimos 90 días" },
  { key: "year", label: "Todo el año" },
  { key: "custom", label: "Personalizado" },
] as const;

export function DealsPerformanceView({
  deals, stages, contactName, contactLastActivityById, onOpenDeal,
  lens, onLens, periodMonth, onPeriodMonth,
}: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "amount", dir: "desc" });
  const [chip, setChip] = useState<Chip>("all");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState<string>("all");
  const [stageId, setStageId] = useState<string>("all");
  const [openStage, setOpenStage] = useState<string | null>(null);
  const { data: products = [] } = useProductCategories();

  const { start, end, label: periodLabel } = useMemo(() => parsePeriod(periodMonth), [periodMonth]);
  const presetKey = periodMonth.startsWith("custom:")
    ? "custom"
    : (PERIOD_PRESETS.some((p) => p.key === periodMonth) ? periodMonth : "month");
  const [, customFrom = "", customTo = ""] = periodMonth.startsWith("custom:") ? periodMonth.split(":") : [];

  // Set inside the period according to the lens (before the secondary filters)
  const periodSet = useMemo(() => {
    return deals.filter((d) => {
      const created = new Date(d.createdAt);
      const closeRef = d.expectedCloseDate ? parseCalendarDate(d.expectedCloseDate) : created;
      const createdIn = created >= start && created < end;
      const closeIn = closeRef >= start && closeRef < end;
      const updatedIn = new Date(d.updatedAt) >= start && new Date(d.updatedAt) < end;
      if (lens === "created") return createdIn;
      if (lens === "all") return createdIn || closeIn || ((d.isWon || d.isLost) && updatedIn);
      // active: open deals whose expected close falls inside the period
      if (d.isWon || d.isLost) return false;
      return closeIn;
    });
  }, [deals, lens, start, end]);

  const base = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodSet.filter((d) =>
      (productIds.length === 0 || (d.productCategoryId ? productIds.includes(d.productCategoryId) : false)) &&
      (owner === "all" || d.ownerName === owner) &&
      (stageId === "all" || d.stageId === stageId) &&
      (!q || d.name.toLowerCase().includes(q) ||
        (d.contactId ? (contactName(d.contactId) ?? "").toLowerCase().includes(q) : false)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodSet, productIds, owner, stageId, search]);

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
    () => deals.filter((d) => (d.isWon || d.isLost) && new Date(d.updatedAt) >= start && new Date(d.updatedAt) < end),
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
    const meta = [[`Lente: ${lens === "created" ? "Activadas en el periodo" : "Activas en el periodo"}`], [`Periodo: ${periodLabel}`], []];
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
    { key: "risk", label: "En riesgo", count: riskCount },
    { key: "stale", label: "Estancadas +14d", count: staleCount },
    { key: "overdue", label: "Vencidas", count: overdueCount },
    { key: "closing", label: "Cierran en el periodo", count: rows.filter((r) => closingInPeriod(r.deal)).length },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar: lente + filtros + export — one row */}
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={lens}
          onValueChange={(v) => v && onLens(v as PerformanceLens)}
          className="border border-border rounded-md shrink-0"
        >
          <ToggleGroupItem value="active" size="sm">Activas en el periodo</ToggleGroupItem>
          <ToggleGroupItem value="created" size="sm">Creadas en el periodo</ToggleGroupItem>
          <ToggleGroupItem value="all" size="sm">Todas del periodo</ToggleGroupItem>
        </ToggleGroup>
        <Select
          value={presetKey}
          onValueChange={(v) => {
            if (v === "custom") {
              const to = iso(new Date());
              const from = iso(new Date(Date.now() - 29 * 86400000));
              onPeriodMonth(`custom:${customFrom || from}:${customTo || to}`);
            } else {
              onPeriodMonth(v);
            }
          }}
        >
          <SelectTrigger className="h-9 w-[150px]" aria-label="Periodo">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_PRESETS.map((p) => (
              <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 w-[200px] justify-between font-normal">
              <span className="truncate">
                {productIds.length === 0
                  ? "Todas las categorías"
                  : productIds.length === 1
                    ? (products.find((p) => p.id === productIds[0])?.name ?? "1 categoría")
                    : `${productIds.length} categorías`}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[260px] p-2">
            <div className="max-h-64 overflow-auto space-y-1">
              {products.map((p) => {
                const checked = productIds.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        setProductIds((prev) => (checked ? prev.filter((x) => x !== p.id) : [...prev, p.id]))
                      }
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{categoryCounts.m.get(p.id) ?? 0}</span>
                  </label>
                );
              })}
              {categoryCounts.none > 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Sin categoría: {categoryCounts.none}
                </div>
              )}
            </div>
            {productIds.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-1 h-8" onClick={() => setProductIds([])}>
                Quitar selección
              </Button>
            )}
          </PopoverContent>
        </Popover>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar oportunidad o contacto"
            className="h-9 w-[220px] pl-7 text-xs"
          />
        </div>
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="Usuario">
            <SelectValue placeholder="Usuario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            {ownerNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stageId} onValueChange={setStageId}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="Etapa">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las etapas</SelectItem>
            {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 ml-auto" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </div>

      {presetKey === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => onPeriodMonth(`custom:${e.target.value}:${customTo}`)}
            className="h-9 w-[160px] text-xs"
          />
          <Input
            type="date"
            value={customTo}
            onChange={(e) => onPeriodMonth(`custom:${customFrom}:${e.target.value}`)}
            className="h-9 w-[160px] text-xs"
          />
        </div>
      )}

      {(productIds.length > 0 || owner !== "all" || stageId !== "all" || search) && (
        <div>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => { setProductIds([]); setOwner("all"); setStageId("all"); setSearch(""); }}>
            Limpiar filtros
          </Button>
        </div>
      )}

      {/* Funnel */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold">Embudo de avance</h3>
          {funnelTop > 0 && (
            <span className="text-[11px] font-semibold rounded-full border border-primary/30 bg-primary/10 text-primary px-2 py-0.5">
              Conversión total {funnelConversionPct}%
            </span>
          )}
        </div>
        {funnelTop === 0 ? (
          <p className="text-sm text-muted-foreground">Sin oportunidades para calcular el embudo.</p>
        ) : (
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

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
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

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortBtn k="name" label="Oportunidad" /></TableHead>
              <TableHead className="text-right"><SortBtn k="amount" label="Monto" /></TableHead>
              <TableHead><SortBtn k="probability" label="Prob." /></TableHead>
              <TableHead className="min-w-[160px]"><SortBtn k="stage" label="Etapa" /></TableHead>
              <TableHead><SortBtn k="days" label="Días" /></TableHead>
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
                  <div className="text-xs text-muted-foreground">{contactName(d.contactId) ?? "Sin contacto"}</div>
                </TableCell>
                <TableCell className="text-right font-semibold text-success">{formatMXN(d.amount)}</TableCell>
                <TableCell className="text-sm">{d.probability}%</TableCell>
                <TableCell className="min-w-[160px]">
                  <StageStepper stages={stages} currentStageId={d.stageId} isWon={d.isWon} isLost={d.isLost} />
                </TableCell>
                <TableCell className="text-xs">
                  <div>{health.daysInStage}d en etapa</div>
                  <div className="text-muted-foreground">
                    {health.daysSinceContactActivity === null ? "Sin actividad" : `${health.daysSinceContactActivity}d sin contacto`}
                  </div>
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
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                  Sin oportunidades para este periodo y lente.
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
        {lens === "created"
          ? `Oportunidades creadas en ${periodLabel}, sin importar cuándo cierren.`
          : `Oportunidades abiertas que estuvieron vivas durante ${periodLabel}, sin importar cuándo se crearon ni cuándo cierren.`}
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
