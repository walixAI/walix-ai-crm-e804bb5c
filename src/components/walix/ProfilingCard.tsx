import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Pencil, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

interface Field { key: string; label: string; required?: boolean; condition?: string }

const empty = (v: unknown) => v === undefined || v === null || String(v).trim() === "";

/** Ficha de perfilamiento: campos del agente de ventas, autocompletados por la IA y editables por el asesor. */
export function ProfilingCard({ contactId }: { contactId: string }) {
  const qc = useQueryClient();
  const key = ["profiling-card", contactId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const sb = supabase as any;
      const [{ data: sessions }, { data: contact }, { data: deals }] = await Promise.all([
        sb.from("sales_agent_sessions").select("id, agent_id, profile_data").eq("contact_id", contactId).order("updated_at", { ascending: false }).limit(1),
        sb.from("contacts").select("tenant_id, custom_fields").eq("id", contactId).maybeSingle(),
        sb.from("deals").select("stage_id, pipeline_stages(pipeline_id)").eq("contact_id", contactId).order("updated_at", { ascending: false }).limit(1),
      ]);
      const session = sessions?.[0] ?? null;
      let agent: any = null;
      if (session?.agent_id) agent = (await sb.from("sales_agents").select("id, name, profiling_fields").eq("id", session.agent_id).maybeSingle()).data;
      const pipelineId = deals?.[0]?.pipeline_stages?.pipeline_id;
      if (!agent && pipelineId) agent = (await sb.from("sales_agents").select("id, name, profiling_fields").eq("pipeline_id", pipelineId).limit(1)).data?.[0] ?? null;
      const fields: Field[] = (Array.isArray(agent?.profiling_fields) ? agent.profiling_fields : []).filter((f: any) => f?.key && f?.label);
      const values = { ...(contact?.custom_fields ?? {}), ...(session?.profile_data ?? {}) };
      return { agent, fields, values, session, custom: contact?.custom_fields ?? {} };
    },
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) setDraft(Object.fromEntries(data.fields.map((f) => [f.key, data.values[f.key] == null ? "" : String(data.values[f.key])])));
  }, [data, editing]);

  if (isLoading || !data || !data.fields.length) return null;
  const { fields, values, session, agent } = data;
  const filled = fields.filter((f) => !empty(values[f.key])).length;
  const pct = Math.round((filled / fields.length) * 100);

  const save = async () => {
    setSaving(true);
    try {
      const sb = supabase as any;
      const clean: Record<string, any> = {};
      for (const f of fields) clean[f.key] = draft[f.key]?.trim() ? draft[f.key].trim() : null;
      const custom = { ...data.custom, ...clean };
      const { error } = await sb.from("contacts").update({ custom_fields: custom }).eq("id", contactId);
      if (error) throw error;
      if (session?.id) {
        const profile = { ...(session.profile_data ?? {}), ...clean };
        const missing = fields.filter((f) => f.required !== false && !f.condition && empty(profile[f.key])).map((f) => f.key);
        const done = fields.filter((f) => !empty(profile[f.key])).length;
        const { error: e2 } = await sb.from("sales_agent_sessions").update({
          profile_data: profile, missing_fields: missing, profile_complete: missing.length === 0,
          score: Math.round((done / fields.length) * 100), updated_at: new Date().toISOString(),
        }).eq("id", session.id);
        if (e2) throw e2;
      }
      toast.success("Ficha actualizada");
      setEditing(false);
      qc.invalidateQueries({ queryKey: key });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar la ficha");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          <ClipboardList className="h-3.5 w-3.5" /> Ficha de perfilamiento
        </div>
        {editing ? (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)} aria-label="Cancelar"><X className="h-3.5 w-3.5" /></Button>
            <Button size="icon" className="h-7 w-7" onClick={save} disabled={saving} aria-label="Guardar"><Check className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)} aria-label="Editar ficha"><Pencil className="h-3.5 w-3.5" /></Button>
        )}
      </div>
      <div className="p-3 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> {agent?.name ?? "Agente"} la completa en la conversación</span>
            <span>{filled}/{fields.length}</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
        <dl className="space-y-2">
          {fields.map((f) => (
            <div key={f.key}>
              <dt className="text-[11px] text-muted-foreground">
                {f.label}{f.required !== false && !f.condition ? " *" : ""}
              </dt>
              {editing ? (
                <Input value={draft[f.key] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} className="h-8 text-sm mt-0.5" />
              ) : (
                <dd className={empty(values[f.key]) ? "text-sm text-muted-foreground/60" : "text-sm text-foreground"}>
                  {empty(values[f.key]) ? "Pendiente" : String(values[f.key])}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
