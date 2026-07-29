import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { usePipelines } from "@/lib/queries/pipeline";

export type RangePreset = "7d" | "30d" | "90d" | "month" | "year" | "custom";

export const RANGE_DAYS: Record<RangePreset, number> = {
  "7d": 7, "30d": 30, "90d": 90, month: 31, year: 365, custom: 30,
};

export interface RangeValue {
  preset: RangePreset;
  from?: string;
  to?: string;
}

/** Converts a range value into the params the dashboard queries expect. */
export function rangeParams(v: RangeValue): { days: number; from?: string; to?: string } {
  if (v.preset === "custom" && v.from && v.to) {
    const days = Math.max(
      1,
      Math.round((new Date(v.to).getTime() - new Date(v.from).getTime()) / 86400000) + 1,
    );
    return { days, from: v.from, to: v.to };
  }
  return { days: RANGE_DAYS[v.preset] };
}

export function ChartFilters({
  pipelineId, onPipeline, range, onRange,
}: {
  pipelineId: string;
  onPipeline: (v: string) => void;
  range: RangeValue;
  onRange: (v: RangeValue) => void;
}) {
  const { data: pipelines = [] } = usePipelines();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={pipelineId} onValueChange={onPipeline}>
        <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Pipeline" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los pipelines</SelectItem>
          {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select
        value={range.preset}
        onValueChange={(v) => {
          const preset = v as RangePreset;
          if (preset === "custom") {
            const to = new Date().toISOString().slice(0, 10);
            const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
            onRange({ preset, from: range.from ?? from, to: range.to ?? to });
          } else {
            onRange({ preset });
          }
        }}
      >
        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Últimos 7 días</SelectItem>
          <SelectItem value="30d">Últimos 30 días</SelectItem>
          <SelectItem value="90d">Últimos 90 días</SelectItem>
          <SelectItem value="month">Mes actual</SelectItem>
          <SelectItem value="year">Últimos 12 meses</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>
      {range.preset === "custom" && (
        <>
          <Input
            type="date"
            value={range.from ?? ""}
            onChange={(e) => onRange({ ...range, preset: "custom", from: e.target.value })}
            className="h-8 w-[150px] text-xs"
          />
          <Input
            type="date"
            value={range.to ?? ""}
            onChange={(e) => onRange({ ...range, preset: "custom", to: e.target.value })}
            className="h-8 w-[150px] text-xs"
          />
        </>
      )}
    </div>
  );
}
