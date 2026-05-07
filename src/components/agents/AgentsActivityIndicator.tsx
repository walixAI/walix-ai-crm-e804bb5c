import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

interface RunningRow { id: string; agent_id: string; agent_name: string; }

export function AgentsActivityIndicator() {
  const navigate = useNavigate();
  const [running, setRunning] = useState<RunningRow[]>([]);

  async function fetchRunning() {
    const { data: runs } = await supabase
      .from("ai_agent_runs")
      .select("id, agent_id")
      .eq("status", "running")
      .limit(10);
    if (!runs?.length) { setRunning([]); return; }
    const ids = Array.from(new Set(runs.map((r) => r.agent_id)));
    const { data: agents } = await supabase
      .from("ai_agents").select("id, name").in("id", ids);
    const map = new Map((agents ?? []).map((a) => [a.id, a.name]));
    setRunning(runs.map((r) => ({ id: r.id, agent_id: r.agent_id, agent_name: map.get(r.agent_id) ?? "Agente" })));
  }

  useEffect(() => {
    fetchRunning();
    const t = setInterval(fetchRunning, 30_000);
    const ch = supabase
      .channel("agents-indicator")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_agent_runs" }, () => fetchRunning())
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, []);

  if (running.length === 0) return null;

  const tooltip = running.length === 1
    ? `${running[0].agent_name} está ejecutando ahora…`
    : `${running.length} agentes ejecutando ahora`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate("/settings?tab=agents")}
            className="relative h-9 w-9 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition"
            aria-label="Agentes ejecutando"
          >
            <Bot className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
              {running.length}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}