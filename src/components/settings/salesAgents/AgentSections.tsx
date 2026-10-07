import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const db = supabase as any;
type P = { a: any; set: (k: string, v: any) => void };

export const TRIGGERS: Record<string, string> = {
  pide_humano: "Pide hablar con una persona",
  molestia: "Se muestra molesto o frustrado",
  insiste_2: "Insiste en un tema después de 2 respuestas",
  ya_hablo_asesor: "Dice que ya habló con un asesor",
  fuera_alcance: "Pregunta algo fuera de alcance (montos exactos, casos específicos, trámites, quejas)",
  quiere_pagar: "Quiere pagar o cerrar ya",
};

function useStages(pipelineId: string) {
  return useQuery({
    queryKey: ["sa-stages", pipelineId],
    queryFn: async () => (await db.from("pipeline_stages").select("id, name, position").eq("pipeline_id", pipelineId).order("position")).data ?? [],
  });
}

function StageSelect({ pipelineId, value, onChange }: { pipelineId: string; value: string | null; onChange: (v: string | null) => void }) {
  const stages = useStages(pipelineId);
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No mover de etapa</SelectItem>
        {(stages.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** 02 Persona y tono: reglas de formato del mensaje. */
export function FormatSection({ a, set }: P) {
  const fr = a.format_rules ?? {};
  const setFr = (k: string, v: any) => set("format_rules", { ...fr, [k]: v });
  return (
    <Card className="p-3 space-y-3">
      <p className="text-sm font-medium">Formato de los mensajes</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Máximo de caracteres por mensaje</Label>
          <Input type="number" min={50} value={fr.max_chars ?? 300} onChange={(e) => setFr("max_chars", Number(e.target.value) || 300)} /></div>
        <div className="space-y-1"><Label>Máximo de emojis por mensaje</Label>
          <Input type="number" min={0} value={fr.max_emojis ?? 1} onChange={(e) => setFr("max_emojis", Number(e.target.value))} /></div>
      </div>
      <div className="flex items-center justify-between"><Label>Una sola pregunta por mensaje</Label>
        <Switch checked={fr.one_question !== false} onCheckedChange={(v) => setFr("one_question", v)} /></div>
      <div className="flex items-center justify-between"><Label>Sin listas ni asteriscos (se lee como conversación)</Label>
        <Switch checked={fr.no_lists !== false} onCheckedChange={(v) => setFr("no_lists", v)} /></div>
      <div className="space-y-1"><Label>Enlace al aviso de privacidad (se comparte en el saludo)</Label>
        <Input value={a.privacy_url ?? ""} onChange={(e) => set("privacy_url", e.target.value)} placeholder="https://..." /></div>
      <p className="text-xs text-muted-foreground">El agente siempre se presenta como asistente virtual y nunca finge ser humano.</p>
    </Card>
  );
}

/** 03 Perfilamiento. */
export function ProfilingSection({ a, set }: P) {
  const fields: any[] = Array.isArray(a.profiling_fields) ? a.profiling_fields : [];
  const [f, setF] = useState({ label: "", key: "", question: "", condition: "" });
  const upd = (list: any[]) => set("profiling_fields", list);
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= fields.length) return;
    const l = [...fields]; [l[i], l[j]] = [l[j], l[i]]; upd(l);
  };
  const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Datos que el agente obtiene, uno por mensaje y en este orden. Si el lead ya los dio (por ejemplo en un formulario), los confirma en vez de volver a preguntar. Al completar todos los obligatorios, el lead se mueve de etapa y se agenda la llamada con el asesor.</p>
      <div className="space-y-2">
        {fields.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay datos de perfilamiento.</p>}
        {fields.map((x, i) => (
          <Card key={x.key + i} className="p-3 flex items-start gap-2">
            <span className="text-sm font-medium w-6">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{x.label}</p>
              {x.question && <p className="text-xs text-muted-foreground">“{x.question}”</p>}
              {x.condition && <p className="text-xs text-muted-foreground">Solo si: {x.condition}</p>}
            </div>
            <Button size="icon" variant="ghost" onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => move(i, 1)} aria-label="Bajar"><ArrowDown className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => upd(fields.filter((_, j) => j !== i))} aria-label="Quitar"><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
      </div>
      <Card className="p-3 space-y-2">
        <p className="text-sm font-medium">Agregar dato</p>
        <Input placeholder="Dato (ej. Licenciatura de interés)" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
        <Input placeholder="Pregunta sugerida (opcional)" value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} />
        <Input placeholder="Solo se pide si… (opcional, ej. acepta Híbrida)" value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })} />
        <Button variant="outline" onClick={() => {
          if (!f.label.trim()) return;
          upd([...fields, { key: slug(f.label) || `dato_${fields.length + 1}`, label: f.label.trim(), question: f.question.trim(), condition: f.condition.trim(), required: true }]);
          setF({ label: "", key: "", question: "", condition: "" });
        }}>Agregar</Button>
      </Card>
      <div className="space-y-1"><Label>Indicaciones de perfilamiento (motivadores, frenos, qué hacer si falta un dato)</Label>
        <Textarea rows={6} value={a.profiling_notes ?? ""} onChange={(e) => set("profiling_notes", e.target.value)} /></div>
      <div className="space-y-1"><Label>Al completar el perfilamiento, mover a la etapa</Label>
        <StageSelect pipelineId={a.pipeline_id} value={a.profiled_stage_id} onChange={(v) => set("profiled_stage_id", v)} /></div>
    </div>
  );
}

/** 06 Objeciones y 08 Conversación tipo. */
export function ObjectionsSection({ a, set }: P) {
  return (
    <div className="space-y-4">
      <div className="space-y-1"><Label>Objeciones frecuentes y respuestas aprobadas</Label>
        <Textarea rows={10} value={a.objections ?? ""} onChange={(e) => set("objections", e.target.value)}
          placeholder={'"Es muy caro" → Reconoce la preocupación, menciona las becas y que el asesor revisa su caso.'} /></div>
      <div className="space-y-1"><Label>Conversaciones modelo (correctas e incorrectas)</Label>
        <Textarea rows={10} value={a.examples ?? ""} onChange={(e) => set("examples", e.target.value)}
          placeholder={"Ejemplo correcto:\nLead: Hola, vi el anuncio\nAsistente: ¡Hola! Soy...\n\nEjemplo incorrecto:\n..."} /></div>
    </div>
  );
}

/** 07 Handoff al asesor. */
export function HandoffSection({ a, set }: P) {
  const trig: string[] = Array.isArray(a.handoff_triggers) ? a.handoff_triggers : [];
  return (
    <div className="space-y-4">
      <Card className="p-3 space-y-2">
        <p className="text-sm font-medium">Transferir de inmediato cuando el lead…</p>
        {Object.entries(TRIGGERS).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <Checkbox checked={trig.includes(k)} onCheckedChange={(v) => set("handoff_triggers", v ? [...trig, k] : trig.filter((t) => t !== k))} />{l}
          </label>
        ))}
        <p className="text-xs text-muted-foreground">Además, al completar el perfilamiento se agenda la llamada con el asesor.</p>
      </Card>
      <div className="space-y-1"><Label>Mensaje al lead al transferir</Label>
        <Input value={a.handoff_message ?? ""} onChange={(e) => set("handoff_message", e.target.value)} /></div>
      <div className="space-y-1"><Label>Al transferir, mover a la etapa</Label>
        <StageSelect pipelineId={a.pipeline_id} value={a.handoff_stage_id} onChange={(v) => set("handoff_stage_id", v)} /></div>
      <div className="space-y-1"><Label>¿A qué asesor se asigna?</Label>
        <Select value={a.assignment_rule ?? "owner"} onValueChange={(v) => set("assignment_rule", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="owner">Al asesor dueño del lead (si no tiene, al de menor carga)</SelectItem>
            <SelectItem value="least_loaded">Al asesor con menos pendientes</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Tiempo máximo para que el asesor llame (minutos)</Label>
        <Input type="number" min={5} className="w-28" value={a.sla_minutes ?? 60} onChange={(e) => set("sla_minutes", Number(e.target.value) || 60)} />
        <p className="text-xs text-muted-foreground">Se crea una tarea con ese vencimiento; si pasa, aparece como vencida.</p></div>
      <p className="text-xs text-muted-foreground">El asesor recibe en la ficha un resumen con los datos de perfilamiento, dudas, motivador, freno y motivo del handoff. Mientras el asesor atiende, el agente no responde.</p>
    </div>
  );
}

/** Métricas del agente. */
export function MetricsSection({ a }: { a: any }) {
  const q = useQuery({
    queryKey: ["sa-metrics", a.id],
    queryFn: async () => (await db.from("sales_agent_sessions").select("lead_replied, profile_complete, state, handoff_reason, profile_data").eq("agent_id", a.id)).data ?? [],
  });
  const rows: any[] = q.data ?? [];
  const n = rows.length || 0;
  const pct = (x: number) => (n ? `${Math.round((x / n) * 100)}%` : "—");
  const replied = rows.filter((r) => r.lead_replied).length;
  const complete = rows.filter((r) => r.profile_complete).length;
  const scheduled = rows.filter((r) => r.handoff_reason === "perfilamiento completo").length;
  const handoffs = rows.filter((r) => r.state === "escalated").length;
  const items = [
    ["Leads atendidos", String(n)], ["Respondieron", pct(replied)], ["Perfilamiento completo", pct(complete)],
    ["Con llamada agendada", pct(scheduled)], ["Transferidos al asesor", pct(handoffs)],
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(([l, v]) => (
        <Card key={l} className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-semibold">{v}</p></Card>
      ))}
    </div>
  );
}
