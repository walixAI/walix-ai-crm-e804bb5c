import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { NewCapabilityWizard } from "./NewCapabilityWizard";

interface Capability {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  recipe_json: any;
  trigger_phrases: string[];
  scope_type: string;
  scope_roles: string[];
  channels: string[];
  require_confirmation: boolean;
  daily_limit: number | null;
  is_active: boolean;
  created_at: string;
}

export function CopilotCapabilitiesTab() {
  const [items, setItems] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("copilot_capabilities")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Capability[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(row: Capability) {
    const { error } = await supabase
      .from("copilot_capabilities")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function remove(row: Capability) {
    if (!confirm(`¿Eliminar la capacidad "${row.name}"?`)) return;
    const { error } = await supabase.from("copilot_capabilities").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Capacidad eliminada");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Capacidades del Copiloto</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Extiende lo que tu Copiloto puede hacer describiéndolo con tus propias palabras. El asistente Walix Builder te ayuda a componer la receta, definir quién puede usarla y en qué canal.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nueva capacidad
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Todavía no hay capacidades personalizadas. Crea la primera para empezar.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((row) => (
            <Card key={row.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">{row.name}</h3>
                    <Badge variant="outline" className="text-xs">{row.kind}</Badge>
                    {row.require_confirmation && (
                      <Badge variant="secondary" className="text-xs">Requiere confirmación</Badge>
                    )}
                    {row.channels.map((c) => (
                      <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                  {row.description && (
                    <p className="text-sm text-muted-foreground mt-1">{row.description}</p>
                  )}
                  {Array.isArray(row.recipe_json?.steps) && (
                    <ol className="text-xs text-muted-foreground mt-2 list-decimal ml-5 space-y-0.5">
                      {row.recipe_json.steps.map((s: any, i: number) => (
                        <li key={i}><span className="font-mono">{s.tool}</span>{s.note ? ` — ${s.note}` : ""}</li>
                      ))}
                    </ol>
                  )}
                  {row.trigger_phrases.length > 0 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {row.trigger_phrases.map((t, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">“{t}”</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Activa</span>
                    <Switch checked={row.is_active} onCheckedChange={() => toggleActive(row)} />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(row)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewCapabilityWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSaved={() => { setWizardOpen(false); load(); }}
      />

      <Card className="p-4 bg-muted/40 border-dashed">
        <p className="text-xs text-muted-foreground">
          <strong>Nota:</strong> las capacidades se guardan y aparecen listadas aquí. La ejecución dinámica de recetas por el Copiloto se conectará en el siguiente paso — hoy el Copiloto sigue usando su catálogo nativo.
        </p>
      </Card>
    </div>
  );
}