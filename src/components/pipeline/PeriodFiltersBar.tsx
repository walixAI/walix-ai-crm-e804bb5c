import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProductCategories } from "@/lib/queries/monthlyGoals";
import { SERVICE_FREQUENCY_OPTIONS } from "@/lib/serviceFrequency";
import type { PipelineDeal, PipelineStage } from "@/lib/queries/pipeline";
import {
  PERIOD_PRESETS, filterPeriodSet, parsePeriod, type PerformanceLens,
} from "./DealsPerformanceView";

export interface PeriodFiltersValue {
  lens: PerformanceLens;
  period: string;
  productIds: string[];
  frequency: string;
  owner: string;
  stageId: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

interface Props {
  value: PeriodFiltersValue;
  onChange: (v: PeriodFiltersValue) => void;
  deals: PipelineDeal[];
  allStages: PipelineStage[];
}

/** Shared filter bar for Kanban, Lista and Desempeño. */
export function PeriodFiltersBar({ value, onChange, deals, allStages }: Props) {
  const { data: products = [] } = useProductCategories();
  const set = (patch: Partial<PeriodFiltersValue>) => onChange({ ...value, ...patch });
  const { lens, period, productIds, frequency, owner, stageId } = value;

  const { start, end } = useMemo(() => parsePeriod(period), [period]);
  const presetKey = period.startsWith("custom:")
    ? "custom"
    : (PERIOD_PRESETS.some((p) => p.key === period) ? period : "month");
  const [, customFrom = "", customTo = ""] = period.startsWith("custom:") ? period.split(":") : [];

  const periodSet = useMemo(
    () => filterPeriodSet(deals, lens, start, end, stageId, allStages),
    [deals, lens, start, end, stageId, allStages],
  );

  const frequencyCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of periodSet) {
      if (d.serviceFrequencyMonths) m.set(d.serviceFrequencyMonths, (m.get(d.serviceFrequencyMonths) ?? 0) + 1);
    }
    return m;
  }, [periodSet]);

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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={lens} onValueChange={(v) => v && set({ lens: v as PerformanceLens })}>
          <SelectTrigger className="h-9 w-[210px] shrink-0" aria-label="Lente">
            <SelectValue placeholder="Lente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activas en el periodo</SelectItem>
            <SelectItem value="created">Creadas en el periodo</SelectItem>
            <SelectItem value="all">Todas del periodo</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={presetKey}
          onValueChange={(v) => {
            if (v === "custom") {
              const to = iso(new Date());
              const from = iso(new Date(Date.now() - 29 * 86400000));
              set({ period: `custom:${customFrom || from}:${customTo || to}` });
            } else {
              set({ period: v });
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
                        set({ productIds: checked ? productIds.filter((x) => x !== p.id) : [...productIds, p.id] })
                      }
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{categoryCounts.m.get(p.id) ?? 0}</span>
                  </label>
                );
              })}
              {categoryCounts.none > 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Sin categoría: {categoryCounts.none}</div>
              )}
            </div>
            {productIds.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-1 h-8" onClick={() => set({ productIds: [] })}>
                Quitar selección
              </Button>
            )}
          </PopoverContent>
        </Popover>
        {frequencyCounts.size > 0 && (
          <Select value={frequency} onValueChange={(v) => set({ frequency: v })}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="Frecuencia">
              <SelectValue placeholder="Frecuencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda frecuencia</SelectItem>
              {SERVICE_FREQUENCY_OPTIONS.filter((o) => frequencyCounts.has(o.months)).map((o) => (
                <SelectItem key={o.months} value={String(o.months)}>
                  {o.label} ({frequencyCounts.get(o.months)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={owner} onValueChange={(v) => set({ owner: v })}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="Usuario">
            <SelectValue placeholder="Usuario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            {ownerNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stageId} onValueChange={(v) => set({ stageId: v })}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="Etapa">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las etapas</SelectItem>
            {allStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {(productIds.length > 0 || owner !== "all" || stageId !== "all" || frequency !== "all") && (
          <Button
            variant="ghost" size="sm" className="h-9"
            onClick={() => set({ productIds: [], owner: "all", stageId: "all", frequency: "all" })}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {presetKey === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={customFrom} onChange={(e) => set({ period: `custom:${e.target.value}:${customTo}` })} className="h-9 w-[160px] text-xs" />
          <Input type="date" value={customTo} onChange={(e) => set({ period: `custom:${customFrom}:${e.target.value}` })} className="h-9 w-[160px] text-xs" />
        </div>
      )}
    </div>
  );
}
