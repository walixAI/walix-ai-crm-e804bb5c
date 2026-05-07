import { useEffect, useState } from "react";
import { Bot, Play, Loader2, Clock, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/sonner";
import { listAgents, setAgentActive, runAgentNow, listAgentRuns, describeCron, type AiAgent, type AiAgentRun } from "@/services/agents";

export default function AgentsSettings() {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [openAgent, setOpenAgent] = useState<AiAgent | null>(null);
  const [runs, setRuns] = useState<AiAgentRun[]>([]);

  async function refresh() {
    setLoading(true);
    try { setAgents(await listAgents()); }
    catch (e: any) { toast.error(e.message ?? "Error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function toggle(a: AiAgent, val: boolean) {
    try {
      await setAgentActive(a.id, val);
      setAgents((prev) => prev.map((x) => x.id === a.id ? { ...x, is_active: val } : x));
    } catch (e: any) { toast.error(e.message); }
  }

  async function execute(a: AiAgent) {
    setRunning(a.id);
    try {
      const res = await runAgentNow(a.id);
      toast.success(`Ejecutado: ${res?.entities_processed ?? 0} entidades, ${res?.actions_taken ?? 0} acciones.`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Error al ejecutar agente");
    } finally { setRunning(null); }
  }

  async function openDetail(a: AiAgent) {
    setOpenAgent(a);
    try { setRuns(await listAgentRuns(a.id)); } catch { setRuns([]); }
  }

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Agentes IA <Badge variant="secondary" className="text-xs">Beta</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            Procesos autónomos que trabajan por ti en background. Cada uno tiene un objetivo y un horario.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {agents.map((a) => (
            <Card key={a.id} className={a.is_active ? "border-primary/30" : "opacity-70"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {a.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                  </div>
                  <Switch checked={a.is_active} onCheckedChange={(v) => toggle(a, v)} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {describeCron(a.schedule)}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <Badge variant="outline">{a.actions_taken_today}/{a.max_actions_per_run} hoy</Badge>
                  {a.last_run_status === "completed" && (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" /> OK
                    </span>
                  )}
                  {a.last_run_status === "failed" && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-3 w-3" /> Falló
                    </span>
                  )}
                  {a.last_run_at && (
                    <span className="text-muted-foreground">
                      Última: {new Date(a.last_run_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => execute(a)} disabled={running === a.id}>
                    {running === a.id
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Ejecutando…</>
                      : <><Play className="h-3.5 w-3.5 mr-1" /> Ejecutar ahora</>}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openDetail(a)}>
                    Ver historial
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!openAgent} onOpenChange={(o) => !o && setOpenAgent(null)}>
        <SheetContent className="w-[480px] sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>{openAgent?.name}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-4">
            <div className="space-y-3">
              {runs.length === 0 && <p className="text-sm text-muted-foreground">Sin ejecuciones aún.</p>}
              {runs.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{new Date(r.started_at).toLocaleString("es-MX")}</span>
                    <Badge variant={r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                      {r.status}
                    </Badge>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{r.entities_processed} entidades</span>
                    <span>{r.actions_taken} acciones</span>
                    <span>{r.suggestions_created} sugerencias</span>
                  </div>
                  {r.error_message && <p className="text-xs text-destructive">{r.error_message}</p>}
                  {r.run_log?.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Log ({r.run_log.length})</summary>
                      <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto text-[10px]">{JSON.stringify(r.run_log, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}