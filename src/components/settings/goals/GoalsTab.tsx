import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTenantGoals, useUpdateGoals } from "@/lib/queries/expenses";
import { toast } from "sonner";

export function GoalsTab() {
  const { data, isLoading } = useTenantGoals();
  const upd = useUpdateGoals();
  const [total, setTotal] = useState("0");
  const [venta, setVenta] = useState("0");
  const [servicio, setServicio] = useState("0");
  const [refaccion, setRefaccion] = useState("0");
  const [biz, setBiz] = useState(true);
  const [green, setGreen] = useState("20");
  const [yellow, setYellow] = useState("10");
  const [orange, setOrange] = useState("0");

  useEffect(() => {
    if (!data) return;
    setTotal(String(data.monthly_goal_total ?? 0));
    const t = data.monthly_goal_by_type ?? {};
    setVenta(String(t.venta ?? 0));
    setServicio(String(t.servicio ?? 0));
    setRefaccion(String(t.refaccion ?? 0));
    setBiz(!!data.count_business_days);
    const th = data.profit_thresholds ?? {};
    setGreen(String(th.green ?? 20));
    setYellow(String(th.yellow ?? 10));
    setOrange(String(th.orange ?? 0));
  }, [data]);

  async function save() {
    try {
      await upd.mutateAsync({
        monthly_goal_total: Number(total) || 0,
        monthly_goal_by_type: {
          venta: Number(venta) || 0,
          servicio: Number(servicio) || 0,
          refaccion: Number(refaccion) || 0,
        },
        count_business_days: biz,
        profit_thresholds: {
          green: Number(green) || 0,
          yellow: Number(yellow) || 0,
          orange: Number(orange) || 0,
        },
      });
      toast.success("Metas guardadas");
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    }
  }

  if (isLoading) return <div className="text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader><CardTitle>Meta mensual</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Meta total del mes (MXN)</Label>
            <Input type="number" value={total} onChange={e => setTotal(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Se usa para calcular tu Run Rate y proyección de cierre.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label>Meta de ventas</Label><Input type="number" value={venta} onChange={e => setVenta(e.target.value)} /></div>
            <div><Label>Meta de servicios</Label><Input type="number" value={servicio} onChange={e => setServicio(e.target.value)} /></div>
            <div><Label>Meta de refacciones</Label><Input type="number" value={refaccion} onChange={e => setRefaccion(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={biz} onCheckedChange={setBiz} />
            <Label className="cursor-pointer">Contar solo días hábiles (Lunes a Viernes)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Semáforo de rentabilidad (%)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <div><Label>Verde ≥</Label><Input type="number" value={green} onChange={e => setGreen(e.target.value)} /></div>
          <div><Label>Amarillo ≥</Label><Input type="number" value={yellow} onChange={e => setYellow(e.target.value)} /></div>
          <div><Label>Naranja ≥</Label><Input type="number" value={orange} onChange={e => setOrange(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={upd.isPending}>Guardar cambios</Button>
      </div>
    </div>
  );
}