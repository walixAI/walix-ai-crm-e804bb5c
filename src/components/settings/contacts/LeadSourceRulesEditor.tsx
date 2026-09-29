import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Globe, FileText, Megaphone, Search, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Kind = "web_domain" | "meta_form" | "meta_ad_account" | "google_ads_account";

const KINDS: { kind: Kind; title: string; help: string; placeholder: string; icon: typeof Globe }[] = [
  { kind: "web_domain", title: "Dominios de tu sitio web", help: "Solo se aceptan leads de formularios web enviados desde estos dominios (incluye sus subdominios).", placeholder: "utel.edu.mx", icon: Globe },
  { kind: "meta_form", title: "Formularios de Meta Ads", help: "Los leads de estos formularios entran a tu empresa. Usa el ID del formulario.", placeholder: "ID del formulario, ej. 1234567890", icon: FileText },
  { kind: "meta_ad_account", title: "Cuentas publicitarias de Meta", help: "Solo se aceptan leads de anuncios de estas cuentas.", placeholder: "act_1234567890", icon: Megaphone },
  { kind: "google_ads_account", title: "Cuentas de Google Ads", help: "Solo se aceptan leads de anuncios de estas cuentas.", placeholder: "123-456-7890", icon: Search },
];

function normalize(kind: Kind, v: string) {
  let s = v.trim().toLowerCase();
  if (kind === "web_domain") return s.replace(/^https?:\/\//, "").split("/")[0].split(":")[0].replace(/^www\./, "");
  if (kind === "meta_ad_account") return s.replace(/^act_/, "").replace(/\D/g, "");
  if (kind === "google_ads_account") return s.replace(/\D/g, "");
  return s.replace(/\D/g, "") || s;
}

interface Rule { id: string; kind: Kind; value: string; label: string | null; is_active: boolean; leads_count: number; last_lead_at: string | null }

export function LeadSourceRulesEditor() {
  const { data: tenantId } = useTenantId();
  const qc = useQueryClient();
  const { data: rules = [] } = useQuery({
    queryKey: ["lead-source-rules", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_source_rules").select("*").eq("tenant_id", tenantId!).order("created_at");
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["lead-source-rules", tenantId] });

  const add = useMutation({
    mutationFn: async ({ kind, value, label }: { kind: Kind; value: string; label: string }) => {
      const v = normalize(kind, value);
      if (!v) throw new Error("Escribe un valor válido");
      const { error } = await supabase.from("lead_source_rules").insert({ tenant_id: tenantId!, kind, value: v, label: label.trim() || null });
      if (error) throw new Error(error.code === "23505" ? "Esta fuente ya está registrada en otra empresa o ya la tienes" : error.message);
    },
    onSuccess: () => { toast.success("Fuente agregada"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async (r: Rule) => {
      const { error } = await supabase.from("lead_source_rules").update({ is_active: !r.is_active }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_source_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Fuentes de ingreso de leads</h3>
        <p className="text-xs text-muted-foreground">
          Define de dónde pueden llegar leads a tu empresa. Si agregas al menos una fuente de un tipo, solo se aceptan leads de ese tipo que coincidan.
          Si un tipo queda vacío, se aceptan todos los de ese tipo.
        </p>
      </div>
      <div className="divide-y divide-border">
        {KINDS.map((k) => (
          <KindSection key={k.kind} meta={k} rules={rules.filter((r) => r.kind === k.kind)}
            onAdd={(value, label) => add.mutate({ kind: k.kind, value, label })}
            onToggle={(r) => toggle.mutate(r)} onRemove={(id) => remove.mutate(id)} />
        ))}
      </div>
    </div>
  );
}

function KindSection({ meta, rules, onAdd, onToggle, onRemove }: {
  meta: (typeof KINDS)[number]; rules: Rule[];
  onAdd: (value: string, label: string) => void; onToggle: (r: Rule) => void; onRemove: (id: string) => void;
}) {
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const Icon = meta.icon;
  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{meta.title}</span>
        <span className="text-xs text-muted-foreground">{rules.length ? `${rules.length} registradas` : "Se aceptan todos"}</span>
      </div>
      <p className="text-xs text-muted-foreground">{meta.help}</p>
      {rules.map((r) => (
        <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{r.label || r.value}</div>
            <div className="text-xs text-muted-foreground truncate">
              {r.label ? `${r.value} · ` : ""}{r.leads_count} leads{r.last_lead_at ? ` · último ${new Date(r.last_lead_at).toLocaleDateString("es-MX")}` : ""}
            </div>
          </div>
          <Switch checked={r.is_active} onCheckedChange={() => onToggle(r)} aria-label="Activa" />
          <Button variant="ghost" size="icon" onClick={() => onRemove(r.id)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!value.trim()) return; onAdd(value, label); setValue(""); setLabel(""); }}>
        <Input className="flex-1 min-w-48" placeholder={meta.placeholder} value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} />
        <Input className="w-48" placeholder="Nombre (opcional)" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} />
        <Button type="submit" size="sm" variant="outline"><Plus className="h-4 w-4" /> Agregar</Button>
      </form>
    </div>
  );
}
