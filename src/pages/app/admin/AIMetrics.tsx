import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Coins, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  tenant_id: string;
  surface: string;
  model: string;
  total_tokens: number;
  iterations: number;
  created_at: string;
};

/** Nombre visible de cada función que consume IA. */
const FEATURE_LABELS: Record<string, string> = {
  lead_assistant: "Resumen del lead",
  sales_agent: "Agente de ventas (WhatsApp)",
  sales_agent_web: "Agente de ventas (chat web)",
  copilot: "Copiloto",
  whatsapp: "Copiloto por WhatsApp",
  agent: "Agentes automáticos",
  ai_agent_runner: "Agentes automáticos",
  ai_context_updater: "Contexto automático del lead",
  typification_suggest: "Sugerencia de tipificación",
  call_analyzer: "Análisis de llamadas",
  contact_ai_suggest: "Sugerencias de contacto",
  dashboard_ai_widgets: "Tarjetas IA del tablero",
  global_ai: "Asistente global",
  pipeline_ai: "IA del pipeline",
  pipeline_suggest: "Sugerencia de pipeline",
  whatsapp_ai: "Respuestas sugeridas WhatsApp",
  wa_campaign_rule_ai: "Reglas de campañas WA",
  automations_ai_draft: "Borradores de automatizaciones",
  copilot_builder: "Creador de habilidades del Copiloto",
  contacts_ai_create: "Alta de contactos con IA",
  ai_onboarding_setup: "Configuración inicial",
  onboarding_seed: "Configuración inicial (datos)",
};
const label = (k: string) => FEATURE_LABELS[k] ?? k;

export default function AIMetrics() {
  const [days, setDays] = useState("30");
  const [tenant, setTenant] = useState("all");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tenants, setTenants] = useState<Record<string, string>>({});
  const [factors, setFactors] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: m }] = await Promise.all([
        supabase.from("tenants").select("id, name").order("name"),
        supabase.from("ai_model_catalog").select("model_id, credit_factor"),
      ]);
      setTenants(Object.fromEntries((t ?? []).map((x: any) => [x.id, x.name])));
      setFactors(Object.fromEntries((m ?? []).map((x: any) => [x.model_id, Number(x.credit_factor ?? 1)])));
    })();
  }, []);

  useEffect(() => {
    setRows(null);
    (async () => {
      const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
      const all: Row[] = [];
      for (let from = 0; from < 50000; from += 1000) {
        let q = supabase
          .from("ai_usage_log")
          .select("tenant_id, surface, model, total_tokens, iterations, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .range(from, from + 999);
        if (tenant !== "all") q = q.eq("tenant_id", tenant);
        const { data } = await q;
        all.push(...((data ?? []) as Row[]));
        if (!data || data.length < 1000) break;
      }
      setRows(all);
    })();
  }, [days, tenant]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const credits = (r: Row) => Math.max(1, r.iterations || 1) * (factors[r.model] ?? 1);
    const byFeature = new Map<string, { runs: number; tokens: number; credits: number }>();
    const byDay = new Map<string, number>();
    let tokens = 0, cr = 0;
    for (const r of rows) {
      const key = label(r.surface);
      const e = byFeature.get(key) ?? { runs: 0, tokens: 0, credits: 0 };
      e.runs += 1; e.tokens += r.total_tokens || 0; e.credits += credits(r);
      byFeature.set(key, e);
      const d = r.created_at.slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + (r.total_tokens || 0));
      tokens += r.total_tokens || 0; cr += credits(r);
    }
    const features = [...byFeature.entries()].sort((a, b) => b[1].tokens - a[1].tokens);
    const daysArr = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return { features, daysArr, tokens, credits: cr, runs: rows.length };
  }, [rows, factors]);

  const maxDay = Math.max(1, ...(stats?.daysArr.map((d) => d[1]) ?? [1]));

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <header className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold tracking-tight">Métricas de IA</h1>
          <p className="text-sm text-muted-foreground mt-1">Qué función consume IA, por empresa y periodo.</p>
        </div>
        <Select value={tenant} onValueChange={setTenant}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las empresas</SelectItem>
            {Object.entries(tenants).map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Últimas 24 h</SelectItem>
            <SelectItem value="7">Últimos 7 días</SelectItem>
            <SelectItem value="30">Últimos 30 días</SelectItem>
            <SelectItem value="90">Últimos 90 días</SelectItem>
          </SelectContent>
        </Select>
      </header>

      {!stats ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" /> Cargando métricas...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Kpi icon={Activity} label="Ejecuciones" value={stats.runs.toLocaleString("es-MX")} />
            <Kpi icon={Zap} label="Tokens totales" value={stats.tokens.toLocaleString("es-MX")} />
            <Kpi icon={Coins} label="Créditos equivalentes" value={Math.round(stats.credits).toLocaleString("es-MX")} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Consumo por función</CardTitle>
              <CardDescription>Ordenado por tokens. El % es sobre el total del periodo.</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.features.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos en este periodo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground bg-muted/20">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Función</th>
                        <th className="text-right px-3 py-2 font-medium">Ejecuciones</th>
                        <th className="text-right px-3 py-2 font-medium">Tokens</th>
                        <th className="text-right px-3 py-2 font-medium">Prom. tokens</th>
                        <th className="text-right px-3 py-2 font-medium">Créditos</th>
                        <th className="text-right px-3 py-2 font-medium w-40">% del total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {stats.features.map(([name, v]) => {
                        const pct = stats.tokens ? (v.tokens / stats.tokens) * 100 : 0;
                        return (
                          <tr key={name} className="hover:bg-muted/30">
                            <td className="px-3 py-2 font-medium">{name}</td>
                            <td className="px-3 py-2 text-right">{v.runs.toLocaleString("es-MX")}</td>
                            <td className="px-3 py-2 text-right">{v.tokens.toLocaleString("es-MX")}</td>
                            <td className="px-3 py-2 text-right">{Math.round(v.tokens / v.runs).toLocaleString("es-MX")}</td>
                            <td className="px-3 py-2 text-right">{Math.round(v.credits).toLocaleString("es-MX")}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2 justify-end">
                                <div className="h-2 w-20 rounded bg-muted overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs w-10 text-right">{pct.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tendencia diaria</CardTitle>
              <CardDescription>Tokens por día (UTC)</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.daysArr.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos en este periodo.</p>
              ) : (
                <div className="flex items-end gap-1 h-40">
                  {stats.daysArr.map(([d, v]) => (
                    <div key={d} className="flex-1 min-w-[4px] bg-primary/80 rounded-t"
                      style={{ height: `${(v / maxDay) * 100}%` }}
                      title={`${d}: ${v.toLocaleString("es-MX")} tokens`} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
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
