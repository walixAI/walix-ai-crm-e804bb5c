import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/walix/Logo";
import { Check, MessageCircle, Users, Zap, Sparkles, Loader2, Workflow, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { suggestPipeline, type PipelineSuggestion } from "@/services/ai";

const steps = [
  { icon: Users, title: "Cuéntanos de tu negocio", desc: "Personalizaremos Walix.ai para ti" },
  { icon: MessageCircle, title: "Conecta WhatsApp", desc: "Multi-agente, sin perder tu número" },
  { icon: Workflow, title: "Configura tu pipeline con IA", desc: "Etapas y campos hechos a tu medida" },
  { icon: Zap, title: "Activa tu IA", desc: "Responde, califica y vende automáticamente" },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [bizName, setBizName] = useState("");
  const [bizDescription, setBizDescription] = useState("");
  const [suggestion, setSuggestion] = useState<PipelineSuggestion | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const runSuggestion = async () => {
    if (!bizDescription.trim()) {
      toast.error("Cuéntale a la IA a qué se dedica tu negocio");
      return;
    }
    setSuggestLoading(true);
    try {
      const r = await suggestPipeline(bizDescription.trim());
      setSuggestion(r);
      if (r.source === "fallback") {
        toast.warning("Usando configuración de demo (la IA no respondió).");
      }
    } finally {
      setSuggestLoading(false);
    }
  };

  const applySuggestion = async () => {
    if (!suggestion || !user) return;
    setApplying(true);
    try {
      // Find tenant + default pipeline
      const { data: profile } = await supabase
        .from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      const tenantId = profile?.tenant_id;
      if (!tenantId) throw new Error("Sin tenant activo");

      const { data: pipelines } = await supabase
        .from("pipelines").select("id, is_default").order("position", { ascending: true });
      let pipelineId = pipelines?.find((p: any) => p.is_default)?.id ?? pipelines?.[0]?.id;

      if (!pipelineId) {
        const { data: created, error: pErr } = await supabase
          .from("pipelines")
          .insert({ tenant_id: tenantId, name: "Pipeline principal", is_default: true, position: 0 })
          .select("id").single();
        if (pErr) throw pErr;
        pipelineId = created.id;
      }

      // Replace stages
      await supabase.from("pipeline_stages").delete().eq("pipeline_id", pipelineId);
      const rows = suggestion.stages.map((s, i) => ({
        tenant_id: tenantId,
        pipeline_id: pipelineId,
        name: s.name,
        position: i,
        is_won: /ganad|cerrad.*gan|won/i.test(s.name),
        is_lost: /perdid|lost/i.test(s.name),
      }));
      const { error: sErr } = await supabase.from("pipeline_stages").insert(rows);
      if (sErr) throw sErr;

      toast.success(`${suggestion.stages.length} etapas creadas en tu pipeline`);
      setStep((s) => s + 1);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo aplicar la configuración");
    } finally {
      setApplying(false);
    }
  };

  const finish = async () => {
    setLoading(true);
    try {
      if (user) {
        await supabase.from("profiles").update({ onboarded: true, full_name: bizName || user.email }).eq("id", user.id);
      }
      toast.success("¡Listo! Bienvenido a Walix.ai");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  const fieldTypeLabel = (t: string) =>
    ({ text: "Texto", number: "Número", date: "Fecha", select: "Selección" } as Record<string, string>)[t] ?? t;

  return (
    <div className="min-h-screen bg-gradient-soft flex flex-col">
      <header className="h-16 px-6 flex items-center border-b border-border bg-card">
        <Logo />
      </header>
      <main className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-2xl">
          {/* Stepper */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full grid place-items-center text-xs font-bold transition-all ${
                  i <= step ? "bg-primary text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && <div className={`h-0.5 w-12 ${i < step ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-card p-8 md:p-10 animate-fade-in">
            <div className="flex items-start gap-4 mb-6">
              <div className="h-12 w-12 rounded-xl bg-gradient-brand grid place-items-center shadow-glow">
                {(() => { const Icon = steps[step].icon; return <Icon className="h-6 w-6 text-primary-foreground" />; })()}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{steps[step].title}</h1>
                <p className="text-sm text-muted-foreground mt-1">{steps[step].desc}</p>
              </div>
            </div>

            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="biz">Nombre de tu negocio</Label>
                  <Input id="biz" value={bizName} onChange={(e) => setBizName(e.target.value)}
                    placeholder="Ej. Tacos El Güero" className="h-11" />
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center bg-muted/30">
                <MessageCircle className="h-12 w-12 mx-auto text-success mb-3" />
                <p className="font-medium">Escanea el QR desde WhatsApp Business</p>
                <p className="text-xs text-muted-foreground mt-1">(simulación · puedes saltarlo)</p>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="bizDesc">¿A qué se dedica tu negocio?</Label>
                  <Textarea
                    id="bizDesc"
                    value={bizDescription}
                    onChange={(e) => setBizDescription(e.target.value)}
                    placeholder="Ej. Vendemos catering corporativo a empresas medianas en CDMX. Ticket promedio $15-50k MXN, ciclo de venta de 2-3 semanas."
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Mientras más específico, mejor configura la IA tus etapas y campos.
                  </p>
                </div>

                {!suggestion && (
                  <Button
                    onClick={runSuggestion}
                    disabled={suggestLoading || !bizDescription.trim()}
                    className="w-full bg-gradient-brand text-primary-foreground"
                  >
                    {suggestLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Configurando con IA…</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" /> Configurar con IA</>
                    )}
                  </Button>
                )}

                {suggestion && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Workflow className="h-3.5 w-3.5" /> Etapas sugeridas
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestion.stages.map((s, i) => (
                          <div key={i} className="px-2.5 py-1 rounded-full bg-card border border-border text-xs">
                            <span className="text-muted-foreground mr-1">{i + 1}.</span>
                            <span className="font-medium">{s.name}</span>
                            <span className="ml-1.5 text-muted-foreground">{s.probability}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
                        Campos personalizados
                      </div>
                      <ul className="space-y-1.5">
                        {suggestion.customFields.map((f, i) => (
                          <li key={i} className="text-xs flex items-start gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[10px] shrink-0">
                              {fieldTypeLabel(f.type)}
                            </span>
                            <div>
                              <div className="font-medium">{f.label}</div>
                              <div className="text-muted-foreground">{f.reason}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
                        Automatizaciones básicas
                      </div>
                      <ul className="space-y-1.5">
                        {suggestion.automations.map((a, i) => (
                          <li key={i} className="text-xs">
                            <span className="font-medium">{a.trigger}</span>
                            <span className="text-muted-foreground"> → {a.action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={runSuggestion}
                        disabled={suggestLoading}
                        className="text-xs"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${suggestLoading ? "animate-spin" : ""}`} />
                        Regenerar
                      </Button>
                      <span className="text-[11px] text-muted-foreground flex-1">
                        Sólo se aplicarán las etapas a tu pipeline. Campos y automatizaciones quedarán como guía.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {step === 3 && (
              <div className="space-y-3">
                {["Califica leads automáticamente", "Responde fuera de horario", "Detecta intención de compra"].map((f) => (
                  <label key={f} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 cursor-pointer transition-colors">
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
                    <span className="text-sm font-medium">{f}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-8 flex justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                Atrás
              </Button>
              {step === 2 && suggestion ? (
                <Button
                  onClick={applySuggestion}
                  disabled={applying}
                  className="bg-gradient-brand text-primary-foreground"
                >
                  {applying ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aplicando…</>
                  ) : (
                    <><Check className="h-4 w-4 mr-2" /> Aplicar y continuar</>
                  )}
                </Button>
              ) : step < steps.length - 1 ? (
                <Button onClick={() => setStep((s) => s + 1)} className="bg-gradient-brand text-primary-foreground">
                  Siguiente
                </Button>
              ) : (
                <Button onClick={finish} disabled={loading} className="bg-gradient-brand text-primary-foreground">
                  {loading ? "Guardando..." : "Entrar a Walix.ai"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}