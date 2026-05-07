import { useEffect, useState } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listAgentRuns, type AiAgentRun } from "@/services/agents";
import { cn } from "@/lib/utils";

interface Props { agentId: string; }

function fmtDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function fmtLogEntry(entry: any): string {
  if (typeof entry === "string") return entry;
  if (entry?.message) return entry.message;
  const ts = entry?.ts ? new Date(entry.ts).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "";
  if (entry?.entity?.label) {
    const tools = (entry.tools ?? []).map((t: any) => t.name).join(", ");
    const ok = entry.tools?.length ? ` → ${tools}` : "";
    return `${ts ? ts + " — " : ""}Procesé ${entry.entity.type} "${entry.entity.label}"${ok}`;
  }
  if (entry?.error) return `${ts ? ts + " — " : ""}⚠ ${entry.error}`;
  return JSON.stringify(entry);
}

export function AgentRunsList({ agentId }: Props) {
  const [runs, setRuns] = useState<AiAgentRun[] | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listAgentRuns(agentId).then((r) => { if (alive) setRuns(r); }).catch(() => setRuns([]));
    return () => { alive = false; };
  }, [agentId]);

  if (runs === null) return <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (runs.length === 0) return <p className="text-xs text-muted-foreground py-3">Sin ejecuciones aún. Usa "Ejecutar ahora" para probar.</p>;

  return (
    <div className="rounded-lg border border-border overflow-hidden text-xs">
      <div className="grid grid-cols-[1fr_70px_70px_70px_80px_24px] gap-2 px-3 py-2 bg-muted/50 font-medium text-muted-foreground">
        <span>Fecha</span><span>Duración</span><span>Entidades</span><span>Acciones</span><span>Status</span><span />
      </div>
      <div className="divide-y divide-border">
        {runs.map((r) => {
          const dur = r.completed_at ? new Date(r.completed_at).getTime() - new Date(r.started_at).getTime() : 0;
          const open = openRun === r.id;
          return (
            <div key={r.id}>
              <button
                onClick={() => setOpenRun(open ? null : r.id)}
                className="w-full grid grid-cols-[1fr_70px_70px_70px_80px_24px] gap-2 px-3 py-2 items-center text-left hover:bg-muted/40 transition"
              >
                <span>{new Date(r.started_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</span>
                <span className="text-muted-foreground">{r.completed_at ? fmtDuration(dur) : "—"}</span>
                <span>{r.entities_processed}</span>
                <span>{r.actions_taken}</span>
                <Badge variant={r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"} className="text-[10px] h-5">
                  {r.status === "completed" ? "OK" : r.status === "failed" ? "Falló" : r.status === "running" ? "Ejecutando" : "Parcial"}
                </Badge>
                <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition", open && "rotate-180")} />
              </button>
              {open && (
                <div className="px-4 py-2 bg-muted/20 space-y-1">
                  {r.error_message && <p className="text-destructive">{r.error_message}</p>}
                  {(r.run_log ?? []).length === 0 && <p className="text-muted-foreground italic">Sin entradas en el log.</p>}
                  {(r.run_log ?? []).map((entry: any, i: number) => (
                    <div key={i} className="font-mono text-[11px] leading-relaxed">{fmtLogEntry(entry)}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}