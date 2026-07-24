import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, LayoutDashboard, CalendarClock } from "lucide-react";
import { CustomizeSheet } from "@/components/walix/widgets/CustomizeSheet";
import { useResolvedLayout, type Surface } from "@/lib/queries/dashboardLayout";
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
              <WidgetsList surface="dashboard" />
            </TabsContent>
            <TabsContent value="mi_dia" className="pt-4">
              <WidgetsList surface="mi_dia" />
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

function WidgetsList({ surface }: { surface: Surface }) {
  const resolved = useResolvedLayout(surface);
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
          <span className={`text-xs px-2 py-0.5 rounded-full ${r.hidden ? "bg-muted text-muted-foreground" : "bg-emerald-500/10 text-emerald-600"}`}>
            {r.hidden ? "Oculta" : "Visible"}
          </span>
          {r.widget.is_mandatory && (
            <span className="text-[10px] text-muted-foreground uppercase">Obligatoria</span>
          )}
        </li>
      ))}
    </ul>
  );
}