import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_SPEND_POLICY, useSaveSpendPolicy, useSpendPolicy, useWaSpendReport, type WaSpendPolicy } from "@/lib/queries/waSpend";

export function WaSpendPolicyCard() {
  const { data } = useSpendPolicy();
  const save = useSaveSpendPolicy();
  const { data: report = [] } = useWaSpendReport(30);
  const [p, setP] = useState<WaSpendPolicy>(DEFAULT_SPEND_POLICY);
  useEffect(() => { if (data) setP(data); }, [data]);
  const num = (k: keyof WaSpendPolicy) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setP({ ...p, [k]: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) } as WaSpendPolicy);

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-semibold">Control de gasto</h3>
        <p className="text-sm text-muted-foreground">
          Dentro de las 24 h después de que el cliente escribe, los mensajes son gratis y sin límite.
          Fuera de esa ventana solo se mandan plantillas, que Meta cobra. Estos límites aplican solo a esas plantillas.
          Gerentes y administradores pueden saltárselos.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Plantillas por lead sin respuesta</Label>
          <Input type="number" value={p.per_lead_max} onChange={num("per_lead_max")} /></div>
        <div className="space-y-1"><Label>Horas mínimas entre plantillas al mismo lead</Label>
          <Input type="number" value={p.per_lead_gap_hours} onChange={num("per_lead_gap_hours")} /></div>
        <div className="space-y-1"><Label>Plantillas pagadas por asesor al día</Label>
          <Input type="number" value={p.per_user_daily} onChange={num("per_user_daily")} /></div>
        <div className="space-y-1"><Label>Tope mensual de créditos (vacío = sin tope)</Label>
          <Input type="number" value={p.monthly_cap ?? ""} onChange={num("monthly_cap")} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={p.include_bot} onCheckedChange={(v) => setP({ ...p, include_bot: v })} />
        Los mensajes del bot cuentan dentro del límite por lead
      </label>
      <Button size="sm" disabled={save.isPending}
        onClick={() => save.mutate(p, { onSuccess: () => toast.success("Límites guardados"), onError: (e: any) => toast.error(e?.message ?? "No se pudo guardar") })}>
        Guardar límites
      </Button>

      <div className="pt-2 border-t border-border">
        <h4 className="text-sm font-semibold mb-2">Plantillas pagadas · últimos 30 días</h4>
        {report.length === 0 ? (
          <p className="text-xs text-muted-foreground">Todavía no se han enviado plantillas pagadas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr>
              <th className="text-left font-medium py-1">Quién</th><th className="text-right font-medium">Enviadas</th>
              <th className="text-right font-medium">Contestaron</th><th className="text-right font-medium">% respuesta</th>
            </tr></thead>
            <tbody>
              {report.map((r) => (
                <tr key={r.userId ?? r.name} className="border-t border-border">
                  <td className="py-1">{r.name}</td><td className="text-right">{r.sent}</td>
                  <td className="text-right">{r.replied}</td>
                  <td className="text-right">{r.sent ? Math.round((r.replied / r.sent) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
