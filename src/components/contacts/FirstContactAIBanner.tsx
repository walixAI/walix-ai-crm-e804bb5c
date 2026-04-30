import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Crea el contacto Juan González con teléfono 5512345678",
  "Agrega a María López, teléfono 5587654321, empresa Acme",
  "Crea contacto Pedro Ramírez como cliente VIP, 5511223344",
];

export function FirstContactAIBanner({ onDismiss }: { onDismiss?: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState(SUGGESTIONS[0]);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("contacts-ai-create", {
        body: { prompt: prompt.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.message ?? data.error);
        return;
      }
      const contact = data?.contact;
      toast.success(`Contacto creado: ${contact?.name ?? ""}`);
      qc.invalidateQueries({ queryKey: ["contacts"] });
      onDismiss?.();
      // Navegar al detalle del contacto
      if (contact?.id) {
        setTimeout(() => navigate(`/contacts/${contact.id}`), 250);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el contacto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-6 md:p-8 shadow-card animate-fade-in">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:bg-muted transition"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-brand grid place-items-center shadow-glow shrink-0">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg md:text-xl font-bold tracking-tight">
            Crea tu primer contacto con IA
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Escribe en lenguaje natural y la IA extrae nombre, teléfono, empresa y etiquetas
            por ti.
          </p>

          <div className="mt-4 space-y-2">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              placeholder="Ej. Crea el contacto Juan González con teléfono 5512345678"
              className="resize-none bg-card"
              maxLength={500}
              disabled={loading}
            />
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrompt(s)}
                  disabled={loading}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition border border-border disabled:opacity-50"
                >
                  {s.length > 60 ? s.slice(0, 57) + "…" : s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button
              onClick={handleCreate}
              disabled={loading || !prompt.trim()}
              className="bg-gradient-brand text-primary-foreground shadow-glow"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Crear con IA
            </Button>
            <span className="text-xs text-muted-foreground">
              o usa el botón <span className="font-mono">+ Nuevo contacto</span> arriba
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}