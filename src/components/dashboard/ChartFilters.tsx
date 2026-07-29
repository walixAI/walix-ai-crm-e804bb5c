import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePipelines } from "@/lib/queries/pipeline";

export type RangePreset = "7d" | "30d" | "90d" | "month" | "year";

export const RANGE_DAYS: Record<RangePreset, number> = {
  "7d": 7, "30d": 30, "90d": 90, month: 31, year: 365,
};

export function ChartFilters({
  pipelineId, onPipeline, range, onRange,
}: {
  pipelineId: string;
  onPipeline: (v: string) => void;
  range: RangePreset;
  onRange: (v: RangePreset) => void;
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
      <Select value={range} onValueChange={(v) => onRange(v as RangePreset)}>
        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Últimos 7 días</SelectItem>
          <SelectItem value="30d">Últimos 30 días</SelectItem>
          <SelectItem value="90d">Últimos 90 días</SelectItem>
          <SelectItem value="month">Mes actual</SelectItem>
          <SelectItem value="year">Últimos 12 meses</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
