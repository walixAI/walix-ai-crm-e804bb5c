import { useState } from "react";
import { Play, Loader2, Settings2, History, ShieldAlert, TrendingDown, Sunrise, GraduationCap, UserCheck, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { setAgentActive, runAgentNow, type AiAgent } from "@/services/agents";
import { describeCron, nextRunFromCron } from "./scheduleHelpers";
import { AgentRunsList } from "./AgentRunsList";
import { cn } from "@/lib/utils";

const ICONS: Record<string, any> = {
  followup_watchdog: ShieldAlert,
  deal_risk_detector: TrendingDown,
  morning_briefing: Sunrise,
  weekly_coach: GraduationCap,
  lead_qualifier: UserCheck,
  custom: Sparkles,
};

interface Props {
  agent: AiAgent;
  isRunning: boolean;
  onChanged: () => void;
  onConfigure: (a: AiAgent) => void;
}

export function AgentCard({ agent, isRunning, onChanged, onConfigure }: Props) {
  const Icon = ICONS[agent.agent_type] ?? Sparkles;
  const [running, setRunning] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const next = nextRunFromCron(agent.schedule);

  async function toggle(v: boolean) {
    try { await setAgentActive(agent.id, v); onChanged(); }
    catch (e: any) { toast.error(e.message); }
  }

  async function execute() {
    setRunning(true);
    try {
      const r = await runAgentNow(agent.id);
      toast.success(`Ejecutado: ${r?.entities_processed ?? 0} entidades, ${r?.actions_taken ?? 0} acciones.`);
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Error al ejecutar agente");
    } finally { setRunning(false); }
  }

  const status = !agent.is_active ? "paused"
    : isRunning ? "running"
    : agent.last_run_status === "failed" ? "error"
    : "active";

  return (
    <Card className={cn("transition", agent.is_active ? "border-primary/30" : "opacity-75")}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
            "bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/20"
          )}>
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{agent.name}</h3>
              <StatusBadge status={status} />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{agent.description}</p>
          </div>
          <Switch checked={agent.is_active} onCheckedChange={toggle} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Próxima ejecución</div>
            <div className="font-medium mt-0.5">
              {agent.is_active && next
                ? `${formatDistanceToNow(next, { addSuffix: true, locale: es })}`
                : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">{describeCron(agent.schedule)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Última ejecución</div>
            <div className="font-medium mt-0.5">
              {agent.last_run_at
                ? formatDistanceToNow(new Date(agent.last_run_at), { addSuffix: true, locale: es })
                : "Nunca"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {agent.actions_taken_today}/{agent.max_actions_per_run} acciones hoy
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={execute} disabled={running || isRunning}>
            {running || isRunning
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Ejecutando…</>
              : <><Play className="h-3.5 w-3.5 mr-1.5" /> Ejecutar ahora</>}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onConfigure(agent)}>
            <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Configurar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowLog(!showLog)}>
            <History className="h-3.5 w-3.5 mr-1.5" /> {showLog ? "Ocultar" : "Ver"} historial
          </Button>
        </div>

        {showLog && <AgentRunsList agentId={agent.id} />}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "active" | "running" | "error" | "paused" }) {
  if (status === "running") return (
    <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/20 text-[10px] h-5">
      <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" /> Ejecutando
    </Badge>
  );
  if (status === "error") return <Badge variant="destructive" className="text-[10px] h-5">Error</Badge>;
  if (status === "paused") return <Badge variant="secondary" className="text-[10px] h-5">Pausado</Badge>;
  return <Badge className="bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30 hover:bg-green-500/20 text-[10px] h-5">Activo</Badge>;
}