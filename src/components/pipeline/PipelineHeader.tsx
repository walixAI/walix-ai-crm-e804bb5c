import { ChevronDown, KanbanSquare, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PipelineFilters, type PipelineFiltersValue } from "./PipelineFilters";
import { ForecastKpis } from "./ForecastKpis";

interface Props {
  view: "kanban" | "list";
  onView: (v: "kanban" | "list") => void;
  filters: PipelineFiltersValue;
  onFilters: (v: PipelineFiltersValue) => void;
  onNew: () => void;
  totalAmount: number;
  weightedAmount: number;
  closingThisMonth: number;
  closingDeltaPct: number | null;
  activeCount: number;
}

export function PipelineHeader({ view, onView, filters, onFilters, onNew, totalAmount, weightedAmount, closingThisMonth, closingDeltaPct, activeCount }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 px-2 -ml-2 gap-1.5">
                <h1 className="text-2xl font-bold tracking-tight">Pipeline Principal</h1>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Pipelines</DropdownMenuLabel>
              <DropdownMenuItem className="font-medium">Pipeline Principal ✓</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>+ Nuevo pipeline (próximamente)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && onView(v as any)} className="border border-border rounded-md">
            <ToggleGroupItem value="kanban" size="sm" aria-label="Kanban">
              <KanbanSquare className="h-3.5 w-3.5" /> Kanban
            </ToggleGroupItem>
            <ToggleGroupItem value="list" size="sm" aria-label="Lista">
              <List className="h-3.5 w-3.5" /> Lista
            </ToggleGroupItem>
          </ToggleGroup>

          <PipelineFilters value={filters} onChange={onFilters} />

          <Button size="sm" className="h-9 bg-primary hover:bg-primary/90" onClick={onNew}>
            <Plus className="h-3.5 w-3.5" /> Nuevo Deal
          </Button>
        </div>
      </div>

      <ForecastKpis
        total={totalAmount}
        weighted={weightedAmount}
        closingThisMonth={closingThisMonth}
        closingDeltaPct={closingDeltaPct}
        activeCount={activeCount}
      />
    </div>
  );
}
