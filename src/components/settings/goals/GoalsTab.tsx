import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTenantGoals, useUpdateGoals } from "@/lib/queries/expenses";
import { toast } from "sonner";
import { AdvancedGoalsCard } from "./AdvancedGoalsCard";
import { ProductCategoriesCard } from "./ProductCategoriesCard";

export function GoalsTab() {
  const { data: tenant, isLoading } = useTenantGoals();
  const updTenant = useUpdateGoals();

  const [biz, setBiz] = useState(true);
  const [green, setGreen] = useState("20");
  const [yellow, setYellow] = useState("10");
  const [orange, setOrange] = useState("0");

  useEffect(() => {
    const th = (tenant as any)?.profit_thresholds ?? {};
    setGreen(String(th.green ?? 20));
    setYellow(String(th.yellow ?? 10));
    setOrange(String(th.orange ?? 0));
    setBiz((tenant as any)?.count_business_days ?? true);
  }, [tenant]);

  async function saveSettings() {
    try {
      await updTenant.mutateAsync({
        monthly_goal_total: Number((tenant as any)?.monthly_goal_total ?? 0),
        monthly_goal_by_type: (tenant as any)?.monthly_goal_by_type ?? { venta: 0, servicio: 0, refaccion: 0 },
        count_business_days: biz,
        profit_thresholds: {
          green: Number(green) || 0,
          yellow: Number(yellow) || 0,
          orange: Number(orange) || 0,
        },
      });
      toast.success("Configuración guardada");
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    }
  }

  if (isLoading) return <div className="text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <AdvancedGoalsCard />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cálculo del Run Rate y rentabilidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={biz} onCheckedChange={setBiz} />
            <Label className="cursor-pointer">Contar solo días hábiles (Lunes a Viernes)</Label>
          </div>
          <div>
            <Label className="text-sm">Semáforo de rentabilidad (%)</Label>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div><Label className="text-xs">Verde ≥</Label><Input type="number" value={green} onChange={e => setGreen(e.target.value)} /></div>
              <div><Label className="text-xs">Amarillo ≥</Label><Input type="number" value={yellow} onChange={e => setYellow(e.target.value)} /></div>
              <div><Label className="text-xs">Naranja ≥</Label><Input type="number" value={orange} onChange={e => setOrange(e.target.value)} /></div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            La meta del mes que alimenta el Run Rate y la proyección de cierre se define arriba, en <b>Metas del mes</b> (meta global de monto).
          </p>
          <div className="flex justify-end">
            <Button variant="outline" onClick={saveSettings} disabled={updTenant.isPending}>Guardar</Button>
          </div>
        </CardContent>
      </Card>

      <ProductCategoriesCard />
    </div>
  );
}
