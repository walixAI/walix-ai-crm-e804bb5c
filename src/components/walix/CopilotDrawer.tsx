import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, X, Plus, Send, Mic, MicOff, Loader2,
  Search, Brain, BarChart3, UserPlus, Briefcase, MoveRight,
  StickyNote, CheckCircle2, MessageCircle, Wrench, Check, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopilot, type CopilotMessage } from "@/store/copilot";
import { getCopilotSuggestions } from "@/lib/constants/copilotSuggestions";
import type { CopilotToolUse } from "@/services/ai";
import { toast } from "@/hooks/use-toast";

// ── Markdown ligero (bold, italic, listas, code inline + bloques) ────────
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
  return <div className="space-y-2">{out}</div>;
}

function renderInline(s: string): ReactNode {
  const html = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-foreground text-[0.85em] font-mono">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Tool rendering ──────────────────────────────────────────────────────
const TOOL_META: Record<string, { icon: any; label: string }> = {
  search_contacts:        { icon: Search,        label: "Búsqueda" },
  get_contact_context:    { icon: Brain,         label: "Contexto" },
  get_pipeline_status:    { icon: BarChart3,     label: "Pipeline" },
  create_contact:         { icon: UserPlus,      label: "Contacto creado" },
  create_deal:            { icon: Briefcase,     label: "Deal creado" },
  move_deal_stage:        { icon: MoveRight,     label: "Deal movido" },
  add_note:               { icon: StickyNote,    label: "Nota agregada" },
  create_task:            { icon: CheckCircle2,  label: "Tarea creada" },
  prepare_whatsapp_message: { icon: MessageCircle, label: "Mensaje preparado" },
};

function ToolCard({ tool }: { tool: CopilotToolUse }) {
  const navigate = useNavigate();
  const meta = TOOL_META[tool.name] ?? { icon: Wrench, label: tool.name };
  const Icon = meta.icon;
  const isError = tool.result && typeof tool.result === "object" && "error" in tool.result;

  // Build a compact summary + optional CTA per tool.
  let summary = "";
  let cta: { label: string; to: string } | null = null;
  const r = tool.result as any;
  switch (tool.name) {
    case "search_contacts": {
      const items = Array.isArray(r?.contacts) ? r.contacts : [];
      summary = items.length ? `${items.length} contactos encontrados` : "Sin resultados";
      break;
    }
    case "get_pipeline_status":
      summary = r?.summary ?? `Pipeline: ${r?.activeDeals ?? "—"} activos`;
      break;
    case "get_contact_context":
      summary = r?.summary ? String(r.summary).slice(0, 120) : "Contexto cargado";
      break;
    case "create_contact":
      summary = r?.contact?.name ? `${r.contact.name}` : "Contacto creado";
      if (r?.contact?.id) cta = { label: "Ver contacto", to: `/contacts/${r.contact.id}` };
      break;
    case "create_deal":
      summary = r?.deal?.name ? `${r.deal.name}` : "Deal creado";
      cta = { label: "Ver pipeline", to: "/pipeline" };
      break;
    case "move_deal_stage":
      summary = r?.deal?.stage_name ? `Movido a ${r.deal.stage_name}` : "Etapa actualizada";
      if (r?.deal?.id) cta = { label: "Ver deal", to: `/pipeline?dealId=${r.deal.id}` };
      break;
    case "add_note":
      summary = "Nota guardada en el contacto";
      break;
    case "create_task":
      summary = r?.task?.title ? r.task.title : "Tarea creada";
      cta = { label: "Ver tareas", to: "/tasks" };
      break;
    case "prepare_whatsapp_message":
      summary = "Borrador listo — confirma abajo";
      break;
    default:
      summary = "Listo";
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs",
        isError
          ? "bg-destructive/5 border-destructive/30 text-destructive"
          : "bg-success/5 border-success/30",
      )}
    >
      <div
        className={cn(
          "h-6 w-6 grid place-items-center rounded-md shrink-0",
          isError ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
        )}
      >
        {isError ? <AlertCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="font-semibold text-foreground">{meta.label}</span>
        </div>
        <div className="text-muted-foreground mt-0.5 truncate">{summary}</div>
      </div>
      {cta && (
        <button
          onClick={() => navigate(cta!.to)}
          className="text-primary hover:underline font-medium shrink-0 self-center"
        >
          {cta.label} →
        </button>
      )}
    </div>
  );
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
    <div className="rounded-xl border-2 border-success bg-success/10 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageCircle className="h-4 w-4 text-success" />
        Enviar mensaje a {msg.pendingWhatsapp.contactName ?? "este contacto"}
      </div>
      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="text-sm min-h-[80px] bg-card"
        />
      ) : (
        <div className="rounded-lg bg-card border border-border px-3 py-2 text-sm whitespace-pre-wrap">
          {draft}
        </div>
      )}
      <div className="flex gap-1.5 flex-wrap">
        <Button
          size="sm"
          onClick={onSend}
          disabled={sending || !draft.trim()}
          className="bg-success hover:bg-success/90 text-success-foreground gap-1 h-8"
        >
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Enviar ahora
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
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
        <div>{msg.text}</div>
        <div className="text-[10px] text-muted-foreground mt-1 text-right">{msg.at}</div>
      </div>
    </div>
  );
}

function AssistantBubble({ msg }: { msg: Extract<CopilotMessage, { role: "assistant" }> }) {
  return (
    <div className="flex gap-2">
      <div className="h-7 w-7 grid place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shrink-0">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {msg.text && (
          <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-3 py-2 text-sm leading-relaxed">
            {renderMarkdown(msg.text)}
          </div>
        )}
        {msg.toolsUsed.length > 0 && (
          <div className="space-y-1.5">
            {msg.toolsUsed.map((t, i) => <ToolCard key={i} tool={t} />)}
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
        className="w-full sm:max-w-[480px] p-0 flex flex-col gap-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div
                  className={cn(
                    "h-9 w-9 grid place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-glow",
                    status !== "idle" && "animate-pulse",
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                </div>
                {status !== "idle" && (
                  <span className="absolute inset-0 rounded-full ring-2 ring-primary/40 animate-ping" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm">Walix Copiloto</span>
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    Beta
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", statusColor, status !== "idle" && "animate-pulse")} />
                  <span className="text-[11px] text-muted-foreground">{statusLabel}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-[11px]"
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
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
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
        <div className="border-t border-border bg-card p-3 space-y-2">
          {suggestions.length > 0 && messages.length === 0 && status === "idle" && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setComposer(""); void send(s); }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20 transition-colors"
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
          <div className="flex items-end gap-1.5">
            <Textarea
              ref={composerRef}
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={onComposerKey}
              placeholder="Pregúntame cualquier cosa…"
              rows={1}
              className="resize-none min-h-[40px] max-h-[96px] text-sm py-2"
            />
            <Button
              size="icon"
              variant={voice.listening ? "destructive" : "outline"}
              className="h-10 w-10 shrink-0"
              onClick={voice.toggle}
              disabled={!voice.supported}
              title={voice.supported ? "Hablar" : "Voz no disponible en este navegador"}
            >
              {voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              className="h-10 w-10 shrink-0 bg-gradient-brand text-primary-foreground"
              onClick={onSend}
              disabled={!composer.trim() || status !== "idle"}
              title="Enviar (Enter)"
            >
              {status !== "idle"
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <div className="text-[10px] text-muted-foreground text-center">
            Enter para enviar · Shift+Enter para salto de línea
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}