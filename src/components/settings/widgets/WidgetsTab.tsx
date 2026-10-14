import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Sparkles, GripVertical, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenantFeatures } from "@/lib/queries/tenantFeatures";
import {
  useWidgetsCatalog, useDashboardLayouts, useSaveLayout,
  SURFACE_LABEL, GROUP_LABEL, type Surface, type UserGroup, type LayoutItem,
} from "@/lib/queries/dashboardLayout";

const RECURRENCE_WIDGETS = ["midia.recurrences", "midia.services", "dash.recurrences_month", "contact.subscriptions", "deal.recurring", "deal.frequency"];
const EXPENSE_WIDGETS = ["midia.profitability", "dash.profitability"];
const SURFACES: Surface[] = ["dashboard", "mi_dia", "contact_detail", "deal_detail"];

interface Row { key: string; name: string; description: string | null; hidden: boolean; locked: boolean; catalogLocked: boolean }

export function WidgetsTab() {
  const { isTenantAdmin } = usePermissions();
  const [surface, setSurface] = useState<Surface>("dashboard");
  const [group, setGroup] = useState<UserGroup>("advisor");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Qué ve cada tipo de usuario
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Elige qué secciones ven los asesores y los supervisores en cada pantalla, en qué orden y cuáles son obligatorias.
          Cada usuario puede ajustar su propia vista, pero nunca podrá ver lo que aquí ocultes ni quitar lo obligatorio.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={group} onValueChange={(v) => setGroup(v as UserGroup)}>
          <TabsList>
            <TabsTrigger value="advisor">{GROUP_LABEL.advisor}</TabsTrigger>
            <TabsTrigger value="supervisor">{GROUP_LABEL.supervisor}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={surface} onValueChange={(v) => setSurface(v as Surface)}>
          <TabsList className="h-auto flex-wrap">
            {SURFACES.map((s) => <TabsTrigger key={s} value={s}>{SURFACE_LABEL[s]}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <GroupEditor key={`${group}-${surface}`} surface={surface} group={group} canEdit={isTenantAdmin} />
      </CardContent>
    </Card>
  );
}

function GroupEditor({ surface, group, canEdit }: { surface: Surface; group: UserGroup; canEdit: boolean }) {
  const catalog = useWidgetsCatalog(surface);
  const layouts = useDashboardLayouts(surface);
  const save = useSaveLayout(surface);
  const { data: features } = useTenantFeatures();
  const [rows, setRows] = useState<Row[] | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (rows || !catalog.data || !layouts.data) return;
    const base = layouts.data.find((l) => l.scope === `group:${group}`) ?? layouts.data.find((l) => l.scope === "tenant_default");
    const items = new Map((base?.items ?? []).map((i) => [i.key, i]));
    const list = catalog.data
      .filter((w) => !(!features?.feature_recurrences && RECURRENCE_WIDGETS.includes(w.key)))
      .filter((w) => !(!features?.feature_expenses && EXPENSE_WIDGETS.includes(w.key)))
      .map((w) => {
        const it = items.get(w.key);
        return {
          pos: it?.position ?? w.default_position,
          row: { key: w.key, name: w.name, description: w.description, hidden: !!it?.hidden && !w.is_mandatory, locked: w.is_mandatory || !!it?.locked, catalogLocked: w.is_mandatory },
        };
      })
      .sort((a, b) => a.pos - b.pos)
      .map((x) => x.row);
    setRows(list);
  }, [catalog.data, layouts.data, features, group, rows]);

  if (!rows) return <div className="text-sm text-muted-foreground">Cargando…</div>;

  const update = (k: string, patch: Partial<Row>) =>
    setRows((prev) => prev!.map((r) => {
      if (r.key !== k) return r;
      const n = { ...r, ...patch };
      if (n.locked) n.hidden = false;
      return n;
    }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const a = prev!.findIndex((r) => r.key === active.id);
      const b = prev!.findIndex((r) => r.key === over.id);
      return arrayMove(prev!, a, b);
    });
  };

  async function onSave() {
    const items: LayoutItem[] = rows!.map((r, i) => ({
      key: r.key, position: (i + 1) * 10, hidden: r.hidden || undefined, locked: (r.locked && !r.catalogLocked) || undefined,
    }));
    try {
      await save.mutateAsync({ scope: `group:${group}`, items });
      toast.success(`Vista de ${GROUP_LABEL[group].toLowerCase()} guardada`);
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e?.message ?? "error"));
    }
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay secciones configurables en esta pantalla.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {rows.map((r) => <SortRow key={r.key} row={r} canEdit={canEdit} onChange={(p) => update(r.key, p)} />)}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={!canEdit || save.isPending}>Guardar</Button>
      </div>
    </div>
  );
}

function SortRow({ row, canEdit, onChange }: { row: Row; canEdit: boolean; onChange: (p: Partial<Row>) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key, disabled: !canEdit });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"
    >
      <button type="button" className="cursor-grab text-muted-foreground hover:text-foreground touch-none" {...attributes} {...listeners} aria-label="Reordenar">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-[160px]">
        <div className="font-medium">{row.name}</div>
        {row.description && <div className="text-xs text-muted-foreground">{row.description}</div>}
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Visible
        <Switch checked={!row.hidden} disabled={!canEdit || row.locked} onCheckedChange={(v) => onChange({ hidden: !v })} />
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" /> Obligatoria
        <Switch checked={row.locked} disabled={!canEdit || row.catalogLocked} onCheckedChange={(v) => onChange({ locked: v })} />
      </label>
    </li>
  );
}
