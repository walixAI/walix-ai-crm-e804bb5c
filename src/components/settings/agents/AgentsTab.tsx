import { useEffect, useMemo, useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { listAgents, type AiAgent } from "@/services/agents";
import { useTenant } from "@/lib/queries/tenant";
import { AgentCard } from "./AgentCard";
import { AgentConfigDialog } from "./AgentConfigDialog";
import { CustomAgentWizard } from "./CustomAgentWizard";

interface Props { tenantId: string; }

export function AgentsTab({ tenantId }: Props) {
  const { data: tenant } = useTenant();
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [configAgent, setConfigAgent] = useState<AiAgent | null>(null);

  async function refresh() {
    setLoading(true);
    try { setAgents(await listAgents()); }
    catch (e: any) { toast.error(e.message ?? "Error al cargar agentes"); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  // Realtime subscription to ai_agent_runs to know which agents are running.
  useEffect(() => {
    const ch = supabase
      .channel("agent-runs-tab")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_agent_runs" }, (payload: any) => {
        const row = payload.new ?? payload.old;
        if (!row) return;
        setRunningIds((prev) => {
          const next = new Set(prev);
          if (payload.eventType === "INSERT" && row.status === "running") next.add(row.agent_id);
          else if (row.status !== "running") next.delete(row.agent_id);
          return next;
        });
        if (payload.eventType === "UPDATE" && row.status !== "running") refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const summary = useMemo(() => {
    const active = agents.filter((a) => a.is_active).length;
    const lastRunDates = agents.map((a) => a.last_run_at).filter(Boolean) as string[];
    const lastRun = lastRunDates.length
      ? new Date(Math.max(...lastRunDates.map((d) => new Date(d).getTime())))
      : null;
    const today = agents.reduce((s, a) => s + (a.actions_taken_today || 0), 0);
    return { active, total: agents.length, lastRun, today };
  }, [agents]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Agentes IA <Badge variant="secondary" className="text-[10px]">Beta</Badge>
            </h2>
            <p className="text-sm text-muted-foreground">Trabajan en segundo plano para tu equipo.</p>
          </div>
        </div>
        <CustomAgentWizard tenantId={tenantId} plan={tenant?.plan} onCreated={refresh} />
      </div>

      <div className="rounded-xl border border-border bg-card/50 px-4 py-3 text-sm flex flex-wrap items-center gap-x-6 gap-y-1">
        <span><strong>{summary.active}</strong> de {summary.total} agentes activos</span>
        <span className="text-muted-foreground">·</span>
        <span>
          Última ejecución{" "}
          <strong>
            {summary.lastRun
              ? formatDistanceToNow(summary.lastRun, { addSuffix: true, locale: es })
              : "—"}
          </strong>
        </span>
        <span className="text-muted-foreground">·</span>
        <span><strong>{summary.today}</strong> acciones hoy</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {agents.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              isRunning={runningIds.has(a.id)}
              onChanged={refresh}
              onConfigure={setConfigAgent}
            />
          ))}
        </div>
      )}

      <AgentConfigDialog
        agent={configAgent}
        open={!!configAgent}
        onClose={() => setConfigAgent(null)}
        onSaved={refresh}
      />
    </div>
  );
}