import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, Trash2, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PipelineStageRule } from "@/lib/queries/pipeline";

export interface StageDraft {
  id: string;
  name: string;
  color: string;
  is_won: boolean;
  is_lost: boolean;
}

interface Props {
  stage: StageDraft;
  rules: PipelineStageRule[];
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (patch: Partial<StageDraft>) => void;
  onDelete: () => void;
  canDelete: boolean;
}

export function SortableStage({ stage, rules, expanded, onToggleExpand, onChange, onDelete, canDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const activeRules = rules.filter(r => r.fromStageId === stage.id && r.isActive);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        isDragging && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-center gap-2 p-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
          aria-label="Reordenar etapa"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <input
          type="color"
          value={hslToHex(stage.color)}
          onChange={(e) => onChange({ color: hexToHsl(e.target.value) })}
          className="h-7 w-7 rounded border border-border bg-background cursor-pointer"
        />
        <Input
          value={stage.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="flex-1 h-9"
        />
        {(stage.is_won || stage.is_lost) && (
          <span className={cn(
            "px-2 py-0.5 rounded-md text-xs font-medium",
            stage.is_won ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {stage.is_won ? "Ganado" : "Perdido"}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleExpand}
          aria-label={expanded ? "Colapsar reglas" : "Expandir reglas"}
          className="h-8 w-8"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={!canDelete}
          aria-label="Eliminar etapa"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {activeRules.length > 0 && !expanded && (
        <div className="px-3 pb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Zap className="h-3 w-3 text-primary" />
          <span>{activeRules.length} regla{activeRules.length === 1 ? "" : "s"} de avance automático</span>
        </div>
      )}
    </div>
  );
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

function hslToHex(hsl: string): string {
  const m = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!m) return "#888888";
  const h = parseInt(m[1]) / 360;
  const s = parseInt(m[2]) / 100;
  const l = parseInt(m[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}