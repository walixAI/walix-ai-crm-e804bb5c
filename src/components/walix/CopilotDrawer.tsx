import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, X, Plus, Send, Mic, MicOff, Loader2,
  MessageCircle, Check, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopilot, type CopilotMessage } from "@/store/copilot";
import { getCopilotSuggestions } from "@/lib/constants/copilotSuggestions";
import { toast } from "@/hooks/use-toast";
import { ToolResult } from "@/components/walix/copilot/ToolResult";
import { useTenant } from "@/lib/queries/tenant";

// ── Markdown ligero (bold, italic, listas, code inline + bloques) ────────
/** Elimina bloques JSON crudos que el modelo a veces pega en su respuesta. */
function stripRawJson(text: string): string {
  if (!text) return "";
  return text
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/^\s*[{[][\s\S]*?[}\]]\s*$/gm, (m) => {
      try { JSON.parse(m.trim()); return ""; } catch { return m; }
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderMarkdown(md: string): ReactNode {
  if (!md) return null;
  const blocks = md.split(/```(\w*)\n([\s\S]*?)```/g);
  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (i % 3 === 0) {
      const text = blocks[i];
      if (!text) continue;
      const lines = text.split("\n");
      out.push(
        <div key={`t-${i}`} className="space-y-1.5">
          {lines.map((line, li) => {
            if (!line.trim()) return <div key={li} className="h-1" />;
            if (/^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
              const stripped = line.replace(/^([-*]|\d+\.)\s/, "");
              return (
                <div key={li} className="flex gap-2 pl-1">
                  <span className="text-primary shrink-0">•</span>
                  <span>{renderInline(stripped)}</span>
                </div>
              );
            }
            return <p key={li}>{renderInline(line)}</p>;
          })}
        </div>,
      );
    } else if (i % 3 === 2) {
      out.push(
        <pre
          key={`c-${i}`}
          className="my-2 rounded-lg bg-muted px-3 py-2 text-xs font-mono overflow-x-auto"
        >
          {blocks[i]}
        </pre>,
      );
    }
  }
  return <div className="space-y-2 break-words">{out}</div>;
}

function renderInline(s: string): ReactNode {
  const html = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-foreground text-[0.85em] font-mono">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function ToolRunningCard() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-xs">
      <div className="h-6 w-6 grid place-items-center rounded-md bg-primary/10 text-primary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-foreground">Ejecutando…</div>
        <div className="text-muted-foreground">El copiloto está trabajando en tu petición</div>
      </div>
    </div>
  );
}

// ── WhatsApp confirmation card ──────────────────────────────────────────
function WhatsappCard({ msg }: { msg: Extract<CopilotMessage, { role: "assistant" }> }) {
  const { confirmWhatsapp, cancelWhatsapp } = useCopilot();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.pendingWhatsapp?.draft ?? "");
  const [sending, setSending] = useState(false);

  if (!msg.pendingWhatsapp) return null;

  if (msg.whatsappStatus === "sent") {
    return (
      <div className="rounded-lg border-2 border-success bg-success/10 px-3 py-2 text-xs text-success-foreground flex items-center gap-2">
        <Check className="h-4 w-4 text-success" />
        <span className="text-foreground font-medium">
          Enviado a {msg.pendingWhatsapp.contactName ?? "el contacto"} · {msg.sentAt}
        </span>
      </div>
    );
  }
  if (msg.whatsappStatus === "cancelled") {
    return (
      <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        Mensaje descartado
      </div>
    );
  }

  const onSend = async () => {
    setSending(true);
    try {
      await confirmWhatsapp(msg.id, draft);
      toast({ title: "Mensaje enviado", description: msg.pendingWhatsapp!.contactName });
    } catch (err) {
      toast({
        title: "No se pudo enviar",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-3 space-y-2 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Walix IA sugiere responder a {msg.pendingWhatsapp.contactName ?? "este contacto"}
      </div>
      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="text-sm min-h-[80px] bg-card"
        />
      ) : (
        <div className="rounded-xl bg-card border border-border/70 px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
          {draft}
        </div>
      )}
      <div className="flex gap-1.5 flex-wrap">
        <Button
          size="sm"
          onClick={onSend}
          disabled={sending || !draft.trim()}
          className="flex-1 bg-gradient-brand text-primary-foreground gap-1 h-9 rounded-xl font-semibold hover:opacity-90"
        >
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
          Enviar por WhatsApp
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Listo" : "Editar"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1 text-muted-foreground"
          onClick={() => cancelWhatsapp(msg.id)}
        >
          <X className="h-3 w-3" /> Cancelar
        </Button>
      </div>
    </div>
  );
}

// ── Bubbles ─────────────────────────────────────────────────────────────
function UserBubble({ msg }: { msg: Extract<CopilotMessage, { role: "user" }> }) {
  return (
    <div className="flex justify-end w-full">
      <div className="max-w-[85%] min-w-0 rounded-2xl rounded-br-md bg-gradient-brand text-primary-foreground px-3.5 py-2.5 text-[13.5px] shadow-md">
        <div className="whitespace-pre-wrap break-words leading-relaxed">{msg.text}</div>
        <div className="text-[10px] opacity-70 mt-1 text-right">{msg.at}</div>
      </div>
    </div>
  );
}

function AssistantBubble({ msg }: { msg: Extract<CopilotMessage, { role: "assistant" }> }) {
  return (
    <div className="flex gap-2 w-full min-w-0">
      <div className="h-7 w-7 grid place-items-center rounded-xl bg-gradient-brand text-primary-foreground shrink-0 shadow-sm">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {stripRawJson(msg.text) && (
          <div className="text-[13.5px] leading-relaxed text-foreground break-words pt-0.5">
            {renderMarkdown(stripRawJson(msg.text))}
          </div>
        )}
        {msg.toolsUsed.length > 0 && (
          <div className="space-y-1.5">
            {msg.toolsUsed.map((t, i) => <ToolResult key={i} tool={t} />)}
          </div>
        )}
        {msg.pendingWhatsapp && <WhatsappCard msg={msg} />}
        <div className="text-[10px] text-muted-foreground">{msg.at}</div>
      </div>
    </div>
  );
}

// ── Voice input (Web Speech API) ────────────────────────────────────────
function useVoice(onText: (text: string) => void, onAutoSubmit: () => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const r = new SR();
    r.lang = "es-MX";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onText(text);
    };
    r.onend = () => {
      setListening(false);
      onAutoSubmit();
    };
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    return () => { try { r.abort(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      try { recognitionRef.current.stop(); } catch { /* noop */ }
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch { /* noop */ }
    }
  };

  return { listening, supported, toggle };
}

// ── Main component ──────────────────────────────────────────────────────
export function CopilotDrawer() {
  const {
    open, status, messages, openDrawer, closeDrawer,
    send, newConversation, refreshProactiveCount,
  } = useCopilot();
  const location = useLocation();
  const { data: tenant } = useTenant();
  const tenantLabel = tenant?.brandName ?? tenant?.name ?? "";
  const [composer, setComposer] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const suggestions = getCopilotSuggestions({ pathname: location.pathname });

  const submitOnVoiceEnd = useRef(false);
  const voice = useVoice(
    (text) => { setComposer(text); submitOnVoiceEnd.current = true; },
    () => {
      if (submitOnVoiceEnd.current && composer.trim()) {
        const t = composer;
        setComposer("");
        submitOnVoiceEnd.current = false;
        void send(t);
      }
    },
  );

  // Auto-scroll on new messages.
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, status]);

  // Refresh proactive count on open.
  useEffect(() => {
    if (open) void refreshProactiveCount();
  }, [open, refreshProactiveCount]);

  // Auto-grow composer.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [composer]);

  const onSend = () => {
    const text = composer.trim();
    if (!text || status !== "idle") return;
    setComposer("");
    void send(text);
  };
  const onComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const statusLabel =
    status === "thinking" ? "Pensando…"
    : status === "executing" ? "Ejecutando…"
    : "Listo";
  const statusColor =
    status === "thinking" ? "bg-warning"
    : status === "executing" ? "bg-info"
    : "bg-success";

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? openDrawer() : closeDrawer())} modal={false}>
      <SheetContent
        side="right"
        className="w-full max-w-full sm:max-w-[460px] p-0 flex flex-col gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="px-4 py-3 pr-12 bg-gradient-brand text-primary-foreground shrink-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                <div
                  className={cn(
                    "h-9 w-9 grid place-items-center rounded-xl bg-primary-foreground/15 text-primary-foreground backdrop-blur-sm",
                    status !== "idle" && "animate-pulse",
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                </div>
                {status !== "idle" && (
                  <span className="absolute inset-0 rounded-xl ring-2 ring-primary-foreground/40 animate-ping" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm truncate">Walix Copiloto</span>
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary-foreground/15 text-primary-foreground/90 border border-primary-foreground/25">
                    Beta
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", statusColor, status !== "idle" && "animate-pulse")} />
                  <span className="text-[11px] text-primary-foreground/80 truncate">
                    {tenantLabel ? `${tenantLabel} · ${statusLabel}` : statusLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-[11px] text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                  onClick={newConversation}
                  title="Empezar nueva conversación"
                >
                  <Plus className="h-3 w-3" /> Nueva
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0 w-full [&>div>div]:!block">
          <div className="p-3 sm:p-4 space-y-4 w-full min-w-0">
            {messages.length === 0 && (
              <div className="text-center pt-8 space-y-3">
                <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-glow">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm">¿En qué te ayudo hoy?</div>
                  <div className="text-xs text-muted-foreground mt-1 max-w-[300px] mx-auto">
                    Puedo buscar, crear, mover y redactar — pero <strong>siempre te pido confirmar</strong> antes de enviar mensajes.
                  </div>
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user"
                ? <UserBubble key={m.id} msg={m} />
                : <AssistantBubble key={m.id} msg={m} />,
            )}

            {status !== "idle" && <ToolRunningCard />}

            <div ref={scrollEndRef} />
          </div>
        </ScrollArea>

        {/* Suggestions + composer */}
        <div className="border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2 shrink-0">
          {suggestions.length > 0 && status === "idle" && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setComposer(""); void send(s); }}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary border border-border/70 hover:border-primary/30 transition-colors"
                >
                  <Sparkles className="inline h-2.5 w-2.5 mr-1 text-accent" />{s}
                </button>
              ))}
            </div>
          )}
          {voice.listening && (
            <div className="flex items-center gap-1.5 text-[11px] text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
              Escuchando…
            </div>
          )}
          <div className="flex items-end gap-1.5 min-w-0">
            <Textarea
              ref={composerRef}
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={onComposerKey}
              placeholder="Pregúntame cualquier cosa…"
              rows={1}
              className="flex-1 min-w-0 resize-none min-h-[44px] max-h-[96px] text-base sm:text-sm py-2.5 rounded-2xl bg-muted/40 border-border/70 focus-visible:ring-primary/40"
            />
            <Button
              size="icon"
              variant={voice.listening ? "destructive" : "outline"}
              className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 rounded-full"
              onClick={voice.toggle}
              disabled={!voice.supported}
              title={voice.supported ? "Hablar" : "Voz no disponible en este navegador"}
            >
              {voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 rounded-full bg-gradient-brand text-primary-foreground shadow-md hover:opacity-90"
              onClick={onSend}
              disabled={!composer.trim() || status !== "idle"}
              title="Enviar (Enter)"
            >
              {status !== "idle"
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <div className="hidden sm:block text-[10px] text-muted-foreground text-center">
            Enter para enviar · Shift+Enter para salto de línea
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}