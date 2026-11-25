import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCreditBalance } from "@/lib/queries/aiModels";
import { usePlanLimits } from "@/lib/queries/planLimits";
import { MessageCircle, Sparkles } from "lucide-react";
import { readAllPages } from "@/lib/queries/paginate";

const SURFACE_LABEL: Record<string, string> = {
  copilot: "Copiloto",
  lead_assistant: "Asistente del lead",
  contact_ai_suggest: "Sugerencias en contactos",
  typification_suggest: "Tipificación sugerida",
  dashboard_ai_widgets: "Tablero con IA",
  call_transcription: "Transcripción de llamadas",
  call_analyzer: "Análisis de llamadas",
  pipeline_ai: "Pipeline con IA",
  sales_agent: "Agente de ventas",
  whatsapp: "Comandos por WhatsApp",
  whatsapp_ai: "Sugerir / resumir en el chat",
  agent: "Agentes IA",
};

/** Resumen compacto del mes: acciones de IA realizadas, créditos usados vs plan y WhatsApp. */
export function MonthlyUsageSummary({ tenantId, plan }: { tenantId: string; plan: string }) {
  const { data: balance } = useCreditBalance(tenantId);
  const { data: limits } = usePlanLimits();
  const limit = limits?.[plan];

  const { data } = useQuery({
    queryKey: ["monthly-usage-summary", tenantId],
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const [ai, wa] = await Promise.all([
        readAllPages((from, to) => supabase.from("ai_usage_log").select("surface, iterations").eq("tenant_id", tenantId).gte("created_at", since).order("id").range(from, to)),
        readAllPages((from, to) => supabase.from("whatsapp_conversation_billing").select("credits_charged").eq("tenant_id", tenantId).gte("created_at", since).order("id").range(from, to)),
      ]);
      const by = new Map<string, number>();
      let actions = 0;
      for (const r of ai) {
        const n = r.iterations ?? 1;
        actions += n;
        by.set(r.surface, (by.get(r.surface) ?? 0) + n);
      }
      let paid = 0, free = 0;
      for (const r of wa) (Number(r.credits_charged ?? 0) > 0 ? paid++ : free++);
      return { actions, top: [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4), paid, free };
    },
  });

  const aiUsed = Number(balance?.ai_used ?? 0);
  const aiTotal = (balance?.ai_included ?? limit?.ai_credits ?? 0) + (balance?.ai_purchased ?? 0);
  const waUsed = balance?.whatsapp_used ?? 0;
  const waTotal = (balance?.whatsapp_included ?? limit?.whatsapp_credits ?? 0) + (balance?.whatsapp_purchased ?? 0);
  const actions = data?.actions ?? 0;
  const freeActions = Math.max(0, actions - Math.round(aiUsed));
  const n = (v: number) => v.toLocaleString("es-MX", { maximumFractionDigits: 0 });

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> IA este mes</div>
        <div>
          <p className="text-3xl font-bold">{n(actions)} <span className="text-sm font-normal text-muted-foreground">acciones realizadas</span></p>
          {freeActions > 0 && <p className="text-xs text-muted-foreground">Las acciones y los créditos del plan se contabilizan por separado.</p>}
        </div>
        <Meter used={aiUsed} total={aiTotal} label="créditos del plan usados" />
        {!!data?.top.length && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {data.top.map(([s, v]) => <span key={s}>{SURFACE_LABEL[s] ?? s}: <b className="text-foreground">{n(v)}</b></span>)}
          </div>
        )}
      </div>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-primary" /> WhatsApp este mes</div>
        <p className="text-3xl font-bold">{n(data?.paid ?? 0)} <span className="text-sm font-normal text-muted-foreground">mensajes cobrados</span></p>
        <Meter used={waUsed} total={waTotal} label="créditos del plan usados" />
        <p className="text-xs text-muted-foreground">{n(data?.free ?? 0)} conversaciones gratis (dentro de 24 h)</p>
      </div>
    </div>
  );
}

function Meter({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{used.toLocaleString("es-MX", { maximumFractionDigits: 0 })} de {total.toLocaleString("es-MX")} {label}</span>
        <span className="font-medium">{pct.toFixed(pct < 10 ? 1 : 0)}%</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}
