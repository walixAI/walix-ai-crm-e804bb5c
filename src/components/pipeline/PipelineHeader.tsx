import { Activity, ChevronDown, KanbanSquare, List, Plus, Search, Settings2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PipelineFilters, type PipelineFiltersValue } from "./PipelineFilters";
import { ForecastKpis } from "./ForecastKpis";
import { RunRateChip } from "@/components/walix/RunRateChip";
import type { Pipeline } from "@/lib/queries/pipeline";

interface Props {
  view: "kanban" | "list" | "performance";
  onView: (v: "kanban" | "list" | "performance") => void;
  filters: PipelineFiltersValue;
  onFilters: (v: PipelineFiltersValue) => void;
  search: string;
  onSearch: (v: string) => void;
  onNew: () => void;
  onOpenAi: () => void;
  pipelines: Pipeline[];
  activePipeline: Pipeline | null;
  onSelectPipeline: (id: string) => void;
  onManagePipelines: () => void;
  totalAmount: number;
  weightedAmount: number;
  closingThisMonth: number;
  closingDeltaPct: number | null;
  activeCount: number;
}

export function PipelineHeader({
  view, onView, filters, onFilters, search, onSearch, onNew, onOpenAi,
  pipelines, activePipeline, onSelectPipeline, onManagePipelines,
  totalAmount, weightedAmount, closingThisMonth, closingDeltaPct, activeCount,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 px-2 -ml-2 gap-1.5">
                <h1 className="text-2xl font-bold tracking-tight">
                  {activePipeline?.name ?? "Pipeline"}
                </h1>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Pipelines</DropdownMenuLabel>
              {pipelines.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  className="font-medium cursor-pointer"
                  onClick={() => onSelectPipeline(p.id)}
                >
                  {p.name} {activePipeline?.id === p.id && "✓"}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onManagePipelines} className="cursor-pointer">
                <Settings2 className="h-3.5 w-3.5 mr-2" /> Gestionar pipelines
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearch(e.target.value.slice(0, 100))}
              placeholder="Buscar oportunidades…"
              className="h-9 pl-7 pr-7 w-[200px]"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <ToggleGroup type="single" value={view} onValueChange={(v) => v && onView(v as any)} className="border border-border rounded-md">
            <ToggleGroupItem value="kanban" size="sm" aria-label="Kanban">
              <KanbanSquare className="h-3.5 w-3.5" /> Kanban
            </ToggleGroupItem>
            <ToggleGroupItem value="list" size="sm" aria-label="Lista">
              <List className="h-3.5 w-3.5" /> Lista
            </ToggleGroupItem>
            <ToggleGroupItem value="performance" size="sm" aria-label="Desempeño">
              <Activity className="h-3.5 w-3.5" /> Desempeño
            </ToggleGroupItem>
          </ToggleGroup>

          <PipelineFilters value={filters} onChange={onFilters} />

          <Button
            size="sm"
            variant="outline"
            className="h-9 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
            onClick={onOpenAi}
          >
            <Sparkles className="h-3.5 w-3.5" /> Insights IA
          </Button>

          <Button size="sm" className="h-9 bg-primary hover:bg-primary/90" onClick={onNew}>
            <Plus className="h-3.5 w-3.5" /> Nueva Oportunidad
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <RunRateChip />
        <ForecastKpis
          total={totalAmount}
          weighted={weightedAmount}
          closingThisMonth={closingThisMonth}
          closingDeltaPct={closingDeltaPct}
          activeCount={activeCount}
        />
      </div>
    </div>
  );
}
