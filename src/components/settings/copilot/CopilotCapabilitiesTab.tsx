import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { NewCapabilityWizard } from "./NewCapabilityWizard";

// Catálogo nativo del Copiloto (debe coincidir con supabase/functions/ai-copilot y copilot-builder).
const NATIVE_CAPABILITIES: { id: string; label: string; risk: "read" | "write"; description: string }[] = [
  { id: "search_contacts", label: "Buscar contactos", risk: "read", description: "Busca contactos por nombre, teléfono o email." },
  { id: "get_contact_context", label: "Leer contexto de contacto", risk: "read", description: "Resumen IA, hechos clave y últimos eventos de un contacto." },
  { id: "get_pipeline_status", label: "Consultar pipeline", risk: "read", description: "KPIs del pipeline: abiertos, ganados, perdidos y monto en curso." },
  { id: "get_my_tasks", label: "Consultar pendientes", risk: "read", description: "Lista tus tareas o las del tenant si eres admin." },
  { id: "get_my_suggestions", label: "Sugerencias proactivas", risk: "read", description: "Devuelve las sugerencias generadas por los agentes IA." },
  { id: "get_my_deals", label: "Consultar oportunidades", risk: "read", description: "Deals abiertos, filtrables por cierre en el mes." },
  { id: "get_profitability", label: "Consultar rentabilidad", risk: "read", description: "Margen del mes vs. gastos e ingresos." },
  { id: "get_run_rate", label: "Consultar run-rate", risk: "read", description: "Proyección de cierre de mes vs. meta." },
  { id: "get_expenses_summary", label: "Consultar gastos", risk: "read", description: "Totales de gastos fijos y variables del periodo." },
  { id: "get_monthly_goal", label: "Consultar meta del mes", risk: "read", description: "Meta vigente y su historial." },
  { id: "get_team_performance", label: "Consultar equipo", risk: "read", description: "Rendimiento por vendedor del mes en curso." },
  { id: "create_contact", label: "Crear contacto", risk: "write", description: "Da de alta un nuevo contacto en el CRM." },
  { id: "create_deal", label: "Crear oportunidad", risk: "write", description: "Crea un deal en el pipeline activo." },
  { id: "move_deal_stage", label: "Mover deal de etapa", risk: "write", description: "Cambia el stage de una oportunidad." },
  { id: "add_note", label: "Agregar nota", risk: "write", description: "Registra una nota en un contacto o deal." },
  { id: "create_task", label: "Crear tarea", risk: "write", description: "Programa un pendiente con fecha y responsable." },
  { id: "prepare_whatsapp_message", label: "Preparar WhatsApp", risk: "write", description: "Redacta un borrador de mensaje — nunca envía sin confirmar." },
];

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

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Capacidades nativas del Copiloto</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Estas son las primitivas incluidas por defecto. Están siempre disponibles y son los bloques con los que se componen las capacidades personalizadas.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {NATIVE_CAPABILITIES.map((c) => (
            <Card key={c.id} className="p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{c.label}</span>
                <Badge
                  variant={c.risk === "write" ? "default" : "secondary"}
                  className="text-[10px] uppercase"
                >
                  {c.risk === "write" ? "Ejecuta" : "Solo lee"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-1 opacity-70">{c.id}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Capacidades personalizadas de este tenant</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Recetas creadas con Walix Builder que combinan las primitivas anteriores.
          </p>
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
      </section>

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