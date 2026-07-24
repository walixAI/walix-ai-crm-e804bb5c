import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { GripVertical, Undo2, Lock } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/hooks/useAuth";
import {
  useResolvedLayout, useSaveLayout, useResetUserLayout,
  type Surface, type LayoutItem,
} from "@/lib/queries/dashboardLayout";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  surface: Surface;
  scope?: "user" | "tenant_default"; // default 'user'
  title?: string;
}

interface Row {
  key: string;
  name: string;
  description: string | null;
  hidden: boolean;
  mandatory: boolean;
  position: number;
}

export function CustomizeSheet({ open, onOpenChange, surface, scope = "user", title }: Props) {
  const { user } = useAuth();
  const resolved = useResolvedLayout(surface);
  const save = useSaveLayout(surface);
  const reset = useResetUserLayout(surface);

  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) return;
    const next: Row[] = resolved.widgets.map((r) => ({
      key: r.widget.key,
      name: r.widget.name,
      description: r.widget.description,
      hidden: r.hidden,
      mandatory: r.widget.is_mandatory,
      position: r.position,
    }));
    next.sort((a, b) => a.position - b.position);
    setRows(next);
  }, [open, resolved.widgets]);

  const scopeKey = useMemo(() => {
    if (scope === "tenant_default") return "tenant_default";
    return `user:${user?.id ?? ""}`;
  }, [scope, user?.id]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.key === active.id);
      const newIndex = prev.findIndex((r) => r.key === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const toggleHidden = (k: string, hidden: boolean) => {
    setRows((prev) => prev.map((r) => (r.key === k ? { ...r, hidden: r.mandatory ? false : hidden } : r)));
  };

  const onSave = async () => {
    const items: LayoutItem[] = rows.map((r, idx) => ({
      key: r.key,
      position: (idx + 1) * 10,
      hidden: r.hidden || undefined,
    }));
    try {
      await save.mutateAsync({ scope: scopeKey, items });
      toast.success(scope === "user" ? "Tu vista fue guardada" : "Vista por defecto guardada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e?.message ?? "error"));
    }
  };

  const onReset = async () => {
    try {
      await reset.mutateAsync();
      toast.success("Vista personal restablecida");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("No se pudo restablecer: " + (e?.message ?? "error"));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title ?? (scope === "user" ? "Personalizar mi vista" : "Layout por defecto del tenant")}</SheetTitle>
          <SheetDescription>
            Arrastra para reordenar. Activa o desactiva las tarjetas que quieres ver en{" "}
            <strong>{surface === "dashboard" ? "Dashboard" : "Mi Día"}</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {rows.map((r) => (
                  <SortableRow key={r.key} row={r} onToggle={(v) => toggleHidden(r.key, !v)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {scope === "user" ? (
            <Button variant="outline" onClick={onReset} disabled={reset.isPending || !resolved.hasUserOverride} size="sm">
              <Undo2 className="h-4 w-4 mr-2" /> Restablecer default
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={onSave} disabled={save.isPending}>Guardar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SortableRow({ row, onToggle }: { row: Row; onToggle: (visible: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const visible = !row.hidden;
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
        aria-label="Reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium truncate">{row.name}</div>
          {row.mandatory && (
            <span title="Obligatoria" className="inline-flex items-center text-[10px] text-muted-foreground gap-1">
              <Lock className="h-3 w-3" /> obligatoria
            </span>
          )}
        </div>
        {row.description && <div className="text-xs text-muted-foreground truncate">{row.description}</div>}
      </div>
      <Switch
        checked={visible}
        onCheckedChange={onToggle}
        disabled={row.mandatory}
        aria-label={visible ? "Ocultar" : "Mostrar"}
      />
    </li>
  );
}