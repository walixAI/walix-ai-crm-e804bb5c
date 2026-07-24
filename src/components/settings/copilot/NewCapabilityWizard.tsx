import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Send, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Msg { role: "user" | "assistant"; content: string; }
interface Props { open: boolean; onClose: () => void; onSaved: () => void; }

function extractRecipe(text: string): any | null {
  if (!text.includes("RECIPE_READY")) return null;
  const match = text.match(/```json\s*([\s\S]*?)```/i);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

export function NewCapabilityWizard({ open, onClose, onSaved }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "Hola. Soy **Walix Builder**. Describe con tus palabras qué quieres que el Copiloto pueda hacer. Por ejemplo: *\"cuando diga 'registra venta a Luis', crea el deal, agrega una nota y programa un pendiente de cobro a 7 días\"*.",
      }]);
    }
    if (!open) {
      setMessages([]); setInput(""); setRecipe(null);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("copilot-builder", {
        body: { action: "chat", messages: next },
      });
      if (error) throw error;
      const reply = data?.reply ?? "";
      setMessages([...next, { role: "assistant", content: reply }]);
      const r = extractRecipe(reply);
      if (r) setRecipe(r);
    } catch (e: any) {
      toast.error(e.message ?? "Error al hablar con Walix Builder");
    } finally {
      setLoading(false);
    }
  }

  async function activate() {
    if (!recipe) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("copilot-builder", {
        body: { action: "save", recipe: { ...recipe, is_active: true } },
      });
      if (error) throw error;
      toast.success("Capacidad activada");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="p-6 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Nueva capacidad del Copiloto
          </SheetTitle>
          <SheetDescription>
            Conversa con Walix Builder para diseñar una receta. Al final podrás probarla o activarla.
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
            </div>
          )}

          {recipe && (
            <Card className="p-4 border-primary/50 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <p className="font-medium text-sm">Receta lista: {recipe.name}</p>
              </div>
              {recipe.description && <p className="text-xs text-muted-foreground mb-2">{recipe.description}</p>}
              <ol className="text-xs list-decimal ml-5 space-y-0.5">
                {(recipe.steps ?? []).map((s: any, i: number) => (
                  <li key={i}><span className="font-mono">{s.tool}</span>{s.note ? ` — ${s.note}` : ""}</li>
                ))}
              </ol>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={activate} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  Activar capacidad
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRecipe(null)}>Ajustar más</Button>
              </div>
            </Card>
          )}
        </div>

        <div className="border-t p-4 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Describe la capacidad…"
            rows={2}
            disabled={loading}
          />
          <Button onClick={send} disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}