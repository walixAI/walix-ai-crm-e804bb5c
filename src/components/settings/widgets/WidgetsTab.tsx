import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, LayoutDashboard, CalendarClock } from "lucide-react";
import { CustomizeSheet } from "@/components/walix/widgets/CustomizeSheet";
import { useResolvedLayout, useSaveLayout, type Surface } from "@/lib/queries/dashboardLayout";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

export function WidgetsTab() {
  const { isTenantAdmin } = usePermissions();
  const [surface, setSurface] = useState<Surface>("dashboard");
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Tarjetas del panel
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Elige qué tarjetas ven todos los usuarios en Dashboard y Mi Día. Marca como obligatorias las que no se puedan ocultar.
            Cada usuario también podrá personalizar su vista personal desde el botón "Personalizar" en cada pantalla.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={surface} onValueChange={(v) => setSurface(v as Surface)}>
            <TabsList>
              <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard</TabsTrigger>
              <TabsTrigger value="mi_dia"><CalendarClock className="h-4 w-4 mr-2" /> Mi Día</TabsTrigger>
            </TabsList>
            <TabsContent value="dashboard" className="pt-4">
              <WidgetsList surface="dashboard" canEdit={isTenantAdmin} />
            </TabsContent>
            <TabsContent value="mi_dia" className="pt-4">
              <WidgetsList surface="mi_dia" canEdit={isTenantAdmin} />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button onClick={() => setSheetOpen(true)} disabled={!isTenantAdmin}>
              Editar layout por defecto
            </Button>
          </div>
        </CardContent>
      </Card>

      <CustomizeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        surface={surface}
        scope="tenant_default"
        title={`Layout por defecto — ${surface === "dashboard" ? "Dashboard" : "Mi Día"}`}
      />
    </div>
  );
}

function WidgetsList({ surface, canEdit }: { surface: Surface; canEdit: boolean }) {
  const resolved = useResolvedLayout(surface);
  const save = useSaveLayout(surface);

  async function toggle(key: string, visible: boolean) {
    const items = resolved.widgets.map((r) => ({
      key: r.widget.key,
      position: r.position,
      hidden: r.widget.key === key ? !visible : r.hidden,
    }));
    try {
      await save.mutateAsync({ scope: "tenant_default", items });
      toast.success(visible ? "Tarjeta visible para todo el equipo" : "Tarjeta oculta para todo el equipo");
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e?.message ?? "error"));
    }
  }

  if (resolved.isLoading) return <div className="text-sm text-muted-foreground">Cargando…</div>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {resolved.widgets.map((r) => (
        <li key={r.widget.key} className="flex items-center gap-3 p-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium">{r.widget.name}</div>
            {r.widget.description && (
              <div className="text-xs text-muted-foreground">{r.widget.description}</div>
            )}
          </div>
          {r.widget.is_mandatory && (
            <span className="text-[10px] text-muted-foreground uppercase">Obligatoria</span>
          )}
          <Switch
            checked={!r.hidden}
            disabled={!canEdit || r.widget.is_mandatory || save.isPending}
            onCheckedChange={(v) => toggle(r.widget.key, v)}
            aria-label={r.hidden ? "Mostrar" : "Ocultar"}
          />
        </li>
      ))}
    </ul>
  );
}