import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCreditBalance } from "@/lib/queries/aiModels";
import { usePlanLimits } from "@/lib/queries/planLimits";
import { BarChart3, MessageCircle, Sparkles } from "lucide-react";

const SURFACE_LABEL: Record<string, string> = {
  copilot: "Copiloto",
  lead_assistant: "Asistente del lead",
  whatsapp: "Comandos por WhatsApp",
  whatsapp_ai: "Sugerir / resumir en el chat",
  agent: "Agentes IA",
};
const WA_CATEGORY: Record<string, string> = {
  marketing: "Plantillas de marketing",
  utility: "Plantillas de servicio",
  authentication: "Plantillas de verificación",
  service: "Conversaciones de servicio",
};

/** Resumen del mes en curso: cuánto se ha consumido de IA y de WhatsApp, y en qué. */
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
        supabase.from("ai_usage_log").select("surface, iterations").eq("tenant_id", tenantId).gte("created_at", since).limit(10000),
        supabase.from("whatsapp_conversation_billing").select("category, credits_charged").eq("tenant_id", tenantId).gte("created_at", since).limit(10000),
      ]);
      const aiBy = new Map<string, number>();
      for (const r of ai.data ?? []) aiBy.set(r.surface, (aiBy.get(r.surface) ?? 0) + (r.iterations ?? 1));
      const waBy = new Map<string, { count: number; credits: number }>();
      let paid = 0, free = 0;
      for (const r of wa.data ?? []) {
        const c = Number(r.credits_charged ?? 0);
        const e = waBy.get(r.category) ?? { count: 0, credits: 0 };
        e.count += 1; e.credits += c; waBy.set(r.category, e);
        if (c > 0) paid += 1; else free += 1;
      }
      return {
        ai: [...aiBy.entries()].sort((a, b) => b[1] - a[1]),
        wa: [...waBy.entries()].sort((a, b) => b[1].credits - a[1].credits),
        paid, free,
      };
    },
  });

  const aiUsed = Number(balance?.ai_used ?? 0);
  const aiTotal = (balance?.ai_included ?? limit?.ai_credits ?? 0) + (balance?.ai_purchased ?? 0);
  const waUsed = balance?.whatsapp_used ?? 0;
  const waTotal = (balance?.whatsapp_included ?? limit?.whatsapp_credits ?? 0) + (balance?.whatsapp_purchased ?? 0);
  const month = new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Consumo del mes</h3>
        <span className="text-xs text-muted-foreground ml-auto capitalize">{month}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Block icon={Sparkles} title="IA" used={aiUsed} total={aiTotal} unit="créditos">
          {data?.ai.length ? data.ai.map(([s, n]) => (
            <Row key={s} label={SURFACE_LABEL[s] ?? s} value={`${n.toLocaleString("es-MX")} usos`} />
          )) : <p className="text-xs text-muted-foreground">Sin uso de IA este mes.</p>}
        </Block>
        <Block icon={MessageCircle} title="WhatsApp" used={waUsed} total={waTotal} unit="créditos">
          {data && (data.paid + data.free) > 0 ? (
            <>
              <Row label="Mensajes cobrados (fuera de 24 h)" value={data.paid.toLocaleString("es-MX")} />
              <Row label="Conversaciones gratis (dentro de 24 h)" value={data.free.toLocaleString("es-MX")} />
              {data.wa.map(([c, e]) => (
                <Row key={c} label={WA_CATEGORY[c] ?? c} value={`${e.credits.toLocaleString("es-MX", { maximumFractionDigits: 2 })} créditos`} />
              ))}
            </>
          ) : <p className="text-xs text-muted-foreground">Sin mensajes cobrados este mes.</p>}
        </Block>
      </div>
      <p className="text-[11px] text-muted-foreground">Los contadores vuelven a cero el día 1 de cada mes. Los créditos comprados no caducan al cambiar de mes.</p>
    </Card>
  );
}

function Block({ icon: Icon, title, used, total, unit, children }: {
  icon: typeof Sparkles; title: string; used: number; total: number; unit: string; children: React.ReactNode;
}) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-primary" /> {title}</div>
      <div>
        <div className="flex items-end justify-between mb-1">
          <span className="text-2xl font-bold">{used.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</span>
          <span className="text-xs text-muted-foreground">de {total.toLocaleString("es-MX")} {unit} usados</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
