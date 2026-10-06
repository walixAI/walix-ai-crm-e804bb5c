import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, CheckCircle2, Loader2, Plus, Send, Target, Trash2, UserRound, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";

type Cond = { field: string; value: string[] };
const FIELDS: Record<string, string> = {
  source: "Origen del lead", tag: "Etiqueta", city: "Ciudad / dirección contiene",
  month: "Temporada (meses 1-12)", score_min: "Calificación mínima",
};
const AUTONOMY: Record<string, string> = {
  solo_sugiere: "Solo sugiere al asesor", mixto: "Mixto (responde lo simple)", autonomo: "Autónomo",
};
const db = supabase as any;

function condLabel(c: Cond) { return `${FIELDS[c.field] ?? c.field}: ${c.value.join(", ")}`; }

function ConditionsEditor({ value, onChange }: { value: Cond[]; onChange: (v: Cond[]) => void }) {
  const [field, setField] = useState("source");
  const [text, setText] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 && <span className="text-xs text-muted-foreground">Sin condiciones</span>}
        {value.map((c, i) => (
          <Badge key={i} variant="secondary" className="gap-1">
            {condLabel(c)}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Quitar">×</button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Select value={field} onValueChange={setField}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(FIELDS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Valores separados por coma" value={text} onChange={(e) => setText(e.target.value)} />
        <Button variant="outline" onClick={() => {
          const vals = text.split(",").map((s) => s.trim()).filter(Boolean);
          if (!vals.length) return;
          onChange([...value, { field, value: vals }]); setText("");
        }}>Agregar</Button>
      </div>
    </div>
  );
}

function AgentEditor({ agent, onClose }: { agent: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [a, setA] = useState<any>(agent);
  const set = (k: string, v: any) => setA((p: any) => ({ ...p, [k]: v }));

  const rules = useQuery({
    queryKey: ["sa-rules", agent.id],
    queryFn: async () => (await db.from("sales_agent_goal_rules").select("*").eq("agent_id", agent.id).order("priority", { ascending: false })).data ?? [],
  });
  const kb = useQuery({
    queryKey: ["sa-kb", agent.id],
    queryFn: async () => (await db.from("sales_agent_knowledge").select("*").or(`agent_id.is.null,agent_id.eq.${agent.id}`).order("created_at")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const { id, tenant_id, pipeline_id, created_at, updated_at, public_key, ...patch } = a;
      const { error } = await db.from("sales_agents").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Agente guardado"); qc.invalidateQueries({ queryKey: ["sales-agents"] }); },
    onError: (e: any) => toast.error(e.message?.includes("unique") ? "Ya hay un agente por defecto en este Pipeline" : e.message),
  });

  const [rule, setRule] = useState<any>({ name: "", goal: "", key_message: "", conditions: [], priority: 10, autonomy: "", allow_close: false });
  const addRule = async () => {
    if (!rule.name || !rule.goal) return toast.error("Nombre y objetivo son obligatorios");
    const { error } = await db.from("sales_agent_goal_rules").insert({ ...rule, autonomy: rule.autonomy || a.autonomy, agent_id: a.id, tenant_id: a.tenant_id });
    if (error) return toast.error(error.message);
    setRule({ name: "", goal: "", key_message: "", conditions: [], priority: 10, autonomy: "", allow_close: false });
    rules.refetch();
  };

  const [k, setK] = useState({ title: "", content: "", url: "", shared: false });
  const addKb = async () => {
    if (!k.title || (!k.content && !k.url)) return toast.error("Agrega título y contenido o enlace");
    const { error } = await db.from("sales_agent_knowledge").insert({
      tenant_id: a.tenant_id, agent_id: k.shared ? null : a.id, title: k.title, content: k.content, url: k.url || null,
      kind: k.url ? "web" : "texto",
    });
    if (error) return toast.error(error.message);
    setK({ title: "", content: "", url: "", shared: false }); kb.refetch();
  };

  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!msg.trim()) return;
    const next = [...chat, { role: "user" as const, content: msg }];
    setChat(next); setMsg(""); setBusy(true);
    const { data, error } = await supabase.functions.invoke("sales-agent", { body: { action: "chat", agent_id: a.id, channel: "test", messages: next } });
    setBusy(false);
    if (error || data?.error) return toast.error(data?.error ?? "No se pudo responder");
    setChat([...next, { role: "assistant", content: data.reply }]);
  };
  const embed = `<script src="https://s1.walix.app/walix-chat.js?key=${a.public_key}" async></script>`;

  const removeAgent = useMutation({
    mutationFn: async () => {
      await db.from("sales_agent_goal_rules").delete().eq("agent_id", a.id);
      await db.from("sales_agent_knowledge").delete().eq("agent_id", a.id);
      await db.from("sales_agent_sessions").delete().eq("agent_id", a.id);
      const { error } = await db.from("sales_agents").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Agente eliminado"); qc.invalidateQueries({ queryKey: ["sales-agents"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <SheetTitle>{a.name}</SheetTitle>
            <Button size="sm" variant="destructive" disabled={removeAgent.isPending}
              onClick={() => { if (confirm(`¿Eliminar "${a.name}"? Se borran sus reglas y su conocimiento propio. Las conversaciones y leads ya creados se conservan.`)) removeAgent.mutate(); }}>
              {removeAgent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-1" />Eliminar</>}
            </Button>
          </div>
        </SheetHeader>
        <Tabs defaultValue="identity" className="mt-4">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="identity">Identidad</TabsTrigger>
            <TabsTrigger value="assign">Reparto</TabsTrigger>
            <TabsTrigger value="goals">Objetivos</TabsTrigger>
            <TabsTrigger value="kb">Conocimiento</TabsTrigger>
            <TabsTrigger value="test">Probar</TabsTrigger>
            <TabsTrigger value="web">Chat web</TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="space-y-4 pt-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><p className="font-medium text-sm">Agente activo</p><p className="text-xs text-muted-foreground">Apagado, sus leads pasan al asesor asignado.</p></div>
              <Switch checked={a.enabled} onCheckedChange={(v) => set("enabled", v)} />
            </div>
            <div className="space-y-1"><Label>Nombre</Label><Input value={a.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="space-y-1"><Label>Quién es y a quién representa</Label><Textarea rows={3} value={a.identity} onChange={(e) => set("identity", e.target.value)} placeholder="Soy Sofía, asesora de admisiones de..." /></div>
            <div className="space-y-1"><Label>Tono</Label><Input value={a.tone} onChange={(e) => set("tone", e.target.value)} /></div>
            <div className="space-y-1"><Label>Nunca debe</Label><Textarea rows={2} value={a.never_do} onChange={(e) => set("never_do", e.target.value)} placeholder="Prometer descuentos, dar precios no publicados..." /></div>
            <div className="space-y-1"><Label>Objetivo por defecto</Label><Textarea rows={2} value={a.default_goal} onChange={(e) => set("default_goal", e.target.value)} /></div>
            <div className="space-y-1"><Label>Mensaje clave</Label><Input value={a.default_key_message} onChange={(e) => set("default_key_message", e.target.value)} /></div>
            <div className="space-y-1"><Label>Autonomía</Label>
              <Select value={a.autonomy} onValueChange={(v) => set("autonomy", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(AUTONOMY).map(([k2, l]) => <SelectItem key={k2} value={k2}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Máximo de respuestas por lead al día (WhatsApp)</Label>
              <Input type="number" min={1} className="w-28" value={a.caps?.replies_per_lead_day ?? 20}
                onChange={(e) => set("caps", { ...(a.caps ?? {}), replies_per_lead_day: Number(e.target.value) })} /></div>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar</Button>
          </TabsContent>

          <TabsContent value="assign" className="space-y-4 pt-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><p className="font-medium text-sm">Agente por defecto ("para todo lo demás")</p><p className="text-xs text-muted-foreground">Atiende a los leads que ningún otro agente cubre. Solo uno por Pipeline.</p></div>
              <Switch checked={a.is_default} onCheckedChange={(v) => set("is_default", v)} />
            </div>
            {!a.is_default && (
              <>
                <div className="space-y-1"><Label>Atiende a leads que cumplan TODAS estas condiciones</Label>
                  <ConditionsEditor value={a.assignment_conditions ?? []} onChange={(v) => set("assignment_conditions", v)} /></div>
                <div className="space-y-1"><Label>Prioridad (desempate)</Label><Input type="number" className="w-28" value={a.priority} onChange={(e) => set("priority", Number(e.target.value))} /></div>
              </>
            )}
            <p className="text-xs text-muted-foreground">Gana el agente con más condiciones coincidentes; si empatan, el de mayor prioridad.</p>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </TabsContent>

          <TabsContent value="goals" className="space-y-4 pt-3">
            <p className="text-sm text-muted-foreground">Reglas que sustituyen el objetivo por defecto. Se aplica la de mayor prioridad que coincida.</p>
            {(rules.data ?? []).map((r: any) => (
              <Card key={r.id} className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{r.name} <span className="text-xs text-muted-foreground">· prioridad {r.priority}</span></p>
                  <div className="flex items-center gap-2">
                    <Switch checked={r.active} onCheckedChange={async (v) => { await db.from("sales_agent_goal_rules").update({ active: v }).eq("id", r.id); rules.refetch(); }} />
                    <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={async () => { await db.from("sales_agent_goal_rules").delete().eq("id", r.id); rules.refetch(); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <p className="text-sm">{r.goal}</p>
                <div className="flex flex-wrap gap-1">{(r.conditions ?? []).map((c: Cond, i: number) => <Badge key={i} variant="outline">{condLabel(c)}</Badge>)}</div>
              </Card>
            ))}
            <Card className="p-3 space-y-2">
              <p className="font-medium text-sm">Nueva regla</p>
              <Input placeholder="Nombre (ej. Beca octubre)" value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} />
              <Textarea rows={2} placeholder="Objetivo" value={rule.goal} onChange={(e) => setRule({ ...rule, goal: e.target.value })} />
              <Input placeholder="Mensaje clave" value={rule.key_message} onChange={(e) => setRule({ ...rule, key_message: e.target.value })} />
              <ConditionsEditor value={rule.conditions} onChange={(v) => setRule({ ...rule, conditions: v })} />
              <div className="flex items-center gap-3">
                <Label className="text-xs">Prioridad</Label>
                <Input type="number" className="w-24" value={rule.priority} onChange={(e) => setRule({ ...rule, priority: Number(e.target.value) })} />
                <label className="flex items-center gap-2 text-sm"><Switch checked={rule.allow_close} onCheckedChange={(v) => setRule({ ...rule, allow_close: v })} />Puede marcar ganada</label>
              </div>
              <Button size="sm" onClick={addRule}><Plus className="h-4 w-4 mr-1" />Agregar regla</Button>
            </Card>
          </TabsContent>

          <TabsContent value="kb" className="space-y-3 pt-3">
            {(kb.data ?? []).map((x: any) => (
              <Card key={x.id} className="p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{x.title} {!x.agent_id && <Badge variant="secondary" className="ml-1">Compartido</Badge>}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{x.url ?? x.content}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={async () => { await db.from("sales_agent_knowledge").delete().eq("id", x.id); kb.refetch(); }}><Trash2 className="h-4 w-4" /></Button>
              </Card>
            ))}
            <Card className="p-3 space-y-2">
              <Input placeholder="Título (ej. Programas y precios)" value={k.title} onChange={(e) => setK({ ...k, title: e.target.value })} />
              <Textarea rows={5} placeholder="Contenido: FAQ, precios, requisitos, políticas..." value={k.content} onChange={(e) => setK({ ...k, content: e.target.value })} />
              <Input placeholder="Enlace de referencia (opcional)" value={k.url} onChange={(e) => setK({ ...k, url: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><Switch checked={k.shared} onCheckedChange={(v) => setK({ ...k, shared: v })} />Compartir con todos los agentes de la empresa</label>
              <Button size="sm" onClick={addKb}><Plus className="h-4 w-4 mr-1" />Agregar conocimiento</Button>
            </Card>
          </TabsContent>

          <TabsContent value="test" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">Escribe como si fueras un lead. Usa la configuración guardada; consume créditos de IA.</p>
            <div className="rounded-lg border p-3 h-80 overflow-y-auto space-y-2 bg-muted/20">
              {chat.map((m, i) => (
                <div key={i} className={m.role === "user" ? "ml-auto max-w-[80%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm w-fit" : "max-w-[85%] text-sm whitespace-pre-wrap"}>{m.content}</div>
              ))}
              {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex gap-2">
              <Input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Hola, quiero información..." />
              <Button onClick={send} disabled={busy} aria-label="Enviar"><Send className="h-4 w-4" /></Button>
            </div>
          </TabsContent>

          <TabsContent value="web" className="space-y-3 pt-3">
            <p className="text-sm">Pega este código antes de <code>&lt;/body&gt;</code> en tu sitio web. Aparecerá un botón de chat atendido por {a.name}.</p>
            <p className="text-xs text-muted-foreground">El agente debe estar encendido. Si el visitante deja teléfono o correo, se crea el contacto y su Oportunidad en este Pipeline; lo hablado por WhatsApp también lo recuerda.</p>
            <pre className="rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-all">{embed}</pre>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(embed); toast.success("Código copiado"); }}>Copiar código</Button>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

export function SalesAgentsTab({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["sales-agents", tenantId],
    queryFn: async () => {
      const [p, a] = await Promise.all([
        db.from("pipelines").select("id, name").eq("tenant_id", tenantId).order("created_at"),
        db.from("sales_agents").select("*").eq("tenant_id", tenantId).order("priority", { ascending: false }),
      ]);
      return { pipelines: p.data ?? [], agents: a.data ?? [] };
    },
  });

  const addAgent = async (pipelineId: string, pipelineName: string) => {
    const { error } = await db.from("sales_agents").insert({
      tenant_id: tenantId, pipeline_id: pipelineId, name: `Agente adicional · ${pipelineName}`,
      is_default: false, enabled: false, assignment_conditions: [{ field: "source", value: ["Meta Lead Ads"] }],
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["sales-agents"] });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Agentes de ventas</h2>
        <p className="text-sm text-muted-foreground">Un agente por Pipeline atiende WhatsApp, chat web y apoya al asesor. Puedes agregar agentes que se reparten leads por cualquier dimensión.</p>
      </div>
      {data!.pipelines.map((p: any) => {
        const agents = data!.agents.filter((a: any) => a.pipeline_id === p.id);
        const def = agents.find((a: any) => a.is_default);
        const covered = def?.enabled;
        return (
          <Card key={p.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-semibold">{p.name}</h3>
              <Button size="sm" variant="outline" onClick={() => addAgent(p.id, p.name)}><Plus className="h-4 w-4 mr-1" />Agregar agente</Button>
            </div>
            <div className={`flex items-start gap-2 rounded-lg p-2.5 text-sm ${covered ? "bg-primary/10" : "bg-destructive/10"}`}>
              {covered ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" /> : <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />}
              <span>{covered
                ? "¿Quién atiende a quién? Todos los leads tienen agente: los que no cubre un agente específico los atiende el agente por defecto."
                : "¿Quién atiende a quién? El agente por defecto está apagado: los leads que no cubre un agente específico los atiende el asesor asignado de forma manual."}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {agents.map((a: any) => (
                <button key={a.id} onClick={() => setEditing(a)} className="text-left rounded-lg border p-3 hover:bg-muted/40 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm flex items-center gap-1.5"><UserRound className="h-4 w-4" />{a.name}</span>
                    <Badge variant={a.enabled ? "default" : "secondary"}>{a.enabled ? "Activo" : "Apagado"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />
                    {a.is_default ? "Para todo lo demás" : (a.assignment_conditions ?? []).map(condLabel).join(" · ") || "Sin condiciones (no atiende a nadie)"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" />{a.default_goal || "Sin objetivo definido"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><BookOpen className="h-3 w-3" />{AUTONOMY[a.autonomy] ?? a.autonomy}</p>
                </button>
              ))}
            </div>
          </Card>
        );
      })}
      {editing && <AgentEditor key={editing.id} agent={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
