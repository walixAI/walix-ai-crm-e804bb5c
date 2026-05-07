import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Cpu, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  tenant_id: string;
  surface: string;
  model: string;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  iterations: number;
  created_at: string;
};

export default function AIMetrics() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("ai_usage_log")
        .select("tenant_id, surface, model, total_tokens, input_tokens, output_tokens, iterations, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      setRows((data ?? []) as Row[]);
    })();
  }, []);

  if (!rows) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" /> Cargando métricas...
      </div>
    );
  }

  const totalRuns = rows.length;
  const totalTokens = rows.reduce((a, r) => a + (r.total_tokens || 0), 0);
  const bySurface = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.surface] = (acc[r.surface] ?? 0) + (r.total_tokens || 0);
    return acc;
  }, {});
  const byTenant = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.tenant_id] = (acc[r.tenant_id] ?? 0) + (r.total_tokens || 0);
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const byModel = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.model] = (acc[r.model] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Métricas de IA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consumo y uso de modelos en los últimos 30 días.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi icon={Activity} label="Ejecuciones" value={totalRuns.toLocaleString()} />
        <Kpi icon={Zap} label="Tokens totales" value={totalTokens.toLocaleString()} />
        <Kpi icon={Cpu} label="Modelos únicos" value={byModel.length.toString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tokens por superficie</CardTitle>
            <CardDescription>Copiloto vs. agentes autónomos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(bySurface).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="capitalize">{k}</span>
                <Badge variant="secondary">{v.toLocaleString()} tk</Badge>
              </div>
            ))}
            {Object.keys(bySurface).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin datos aún.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modelos más usados</CardTitle>
            <CardDescription>Por número de ejecuciones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {byModel.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs">{k}</span>
                <Badge variant="outline">{v}</Badge>
              </div>
            ))}
            {byModel.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin datos aún.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top tenants por consumo</CardTitle>
          <CardDescription>Tokens consumidos en los últimos 30 días</CardDescription>
        </CardHeader>
        <CardContent>
          {byTenant.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground bg-muted/20">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Tenant</th>
                    <th className="text-right px-3 py-2 font-medium">Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {byTenant.map(([t, v]) => (
                    <tr key={t} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{t}</td>
                      <td className="px-3 py-2 text-right font-semibold">{v.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}