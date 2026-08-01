import { useEffect, useRef, useState } from "react";
import { Paperclip, Smile, Send, StickyNote, Sparkles, FileText, Slash, Clock, AlertCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MessageTemplate } from "@/lib/queries/whatsapp";
import type { Guidance } from "@/lib/whatsapp/guidance";

interface Props {
  draft: string;
  onDraftChange: (v: string) => void;
  templates: MessageTemplate[];
  onSend: (body: string, opts?: { internal?: boolean }) => void;
  sending?: boolean;
  onAiSuggest?: () => void;
  onAiSummarize?: () => void;
  onAiPrompt?: (prompt: string) => void;
  aiLoading?: boolean;
  onOpenTemplates?: () => void;
  onPickTemplate?: (t: MessageTemplate) => void;
  /**
   * Marca el draft actual como generado por IA. Cuando es true se muestra
   * un badge "Borrador IA" sobre el textarea y se limpia automáticamente
   * cuando el usuario edita el contenido.
   */
  aiDraftActive?: boolean;
  onClearAiDraft?: () => void;
  /** Guía contextual: define el copy y si se resalta el botón de IA. */
  guidance?: Guidance | null;
  /** Aviso sobre la ventana de 24 h / costo del mensaje. */
  windowNotice?: { tone: "open" | "closing" | "closed"; text: string } | null;
}

export function Composer({
  draft, onDraftChange, templates, onSend, sending,
  onAiSuggest, onAiSummarize, onAiPrompt, aiLoading,
  onOpenTemplates, onPickTemplate, aiDraftActive, onClearAiDraft,
  guidance, windowNotice,
}: Props) {
  const [internal, setInternal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [tplFilter, setTplFilter] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const highlight = guidance?.state === "awaiting_reply";

  // auto-grow
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  // detect "/" prefix to open templates
  useEffect(() => {
    if (draft.startsWith("/")) {
      setShowTemplates(true);
      setTplFilter(draft.slice(1).toLowerCase());
    } else {
      setShowTemplates(false);
    }
  }, [draft]);

  const filteredTpl = templates.filter((t) => t.name.toLowerCase().includes(tplFilter));

  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    onSend(v, { internal });
    onDraftChange("");
    setInternal(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const insertTemplate = (t: MessageTemplate) => {
    if (onPickTemplate) {
      onPickTemplate(t);
    } else {
      onDraftChange(t.content);
    }
    setShowTemplates(false);
    setTimeout(() => taRef.current?.focus(), 0);
  };

  return (
    <div className="border-t border-border bg-card">
      {/* Aviso de ventana de 24 h / costo */}
      {windowNotice && (
        <div
          className={cn(
            "px-3 py-1.5 text-[11px] font-medium border-b flex items-center gap-1.5",
            windowNotice.tone === "closed" && "bg-destructive/10 text-destructive border-destructive/20",
            windowNotice.tone === "closing" && "bg-warning/10 text-warning border-warning/20",
            windowNotice.tone === "open" && "bg-success/10 text-success border-success/20",
          )}
        >
          {windowNotice.tone === "closed" ? (
            <>
              <AlertCircle className="h-3.5 w-3.5" />
              <CreditCard className="h-3.5 w-3.5" />
            </>
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
          {windowNotice.text}
        </div>
      )}
      {/* AI bar */}
      <div className="bg-primary/5 border-b border-primary/10 px-3 py-2 flex items-center gap-2 flex-wrap">
        <TooltipProvider delayDuration={200}>
          <Tooltip open={highlight && !aiLoading ? true : undefined}>
            <TooltipTrigger asChild>
              <span className="relative flex">
                {highlight && !aiLoading && (
                  <span className="absolute inset-0 rounded-md bg-primary/30 animate-ping pointer-events-none" />
                )}
                <Button
                  size="sm"
                  variant={highlight ? "default" : "outline"}
                  className={cn("h-7 text-xs gap-1.5 relative", !highlight && "hover:bg-primary/10 border-primary/30")}
                  onClick={onAiSuggest}
                  disabled={aiLoading}
                >
                  <Sparkles className={cn("h-3.5 w-3.5", highlight ? "" : "text-primary")} />
                  {aiLoading ? "Redactando…" : guidance?.ctaLabel ?? "Sugerir respuesta"}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-[240px] text-xs">
              {guidance?.tooltip ??
                "Haz clic aquí: la IA redacta un borrador, tú lo revisas y decides si se envía."}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {guidance && !aiLoading && (
          <span
            className={cn(
              "text-[11px] font-medium",
              highlight ? "text-primary" : "text-muted-foreground",
            )}
          >
            {guidance.hint}
          </span>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5 hover:bg-primary/10" onClick={onAiSummarize} disabled={aiLoading}>
          <FileText className="h-3.5 w-3.5 text-primary" />
          Resumir
        </Button>
        <div className="flex-1 min-w-[180px] flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground hidden sm:inline">🤖</span>
          <input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && aiPrompt.trim() && onAiPrompt) {
                onAiPrompt(aiPrompt.trim());
                setAiPrompt("");
              }
            }}
            placeholder="Prompt IA: ej. 'Redacta una propuesta formal'"
            className="flex-1 bg-transparent text-xs px-2 py-1 outline-none placeholder:text-muted-foreground"
            disabled={aiLoading}
          />
        </div>
      </div>

      {/* Templates dropdown */}
      {showTemplates && (
        <div className="border-b border-border bg-popover max-h-56 overflow-auto">
          {filteredTpl.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">Sin plantillas</div>
          )}
          {filteredTpl.map((t) => (
            <button
              key={t.id}
              onClick={() => insertTemplate(t)}
              className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b border-border last:border-0"
            >
              <div className="text-xs font-medium">{t.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{t.content}</div>
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className={cn("p-3 flex items-end gap-2", internal && "bg-warning/5", aiDraftActive && !internal && "bg-primary/5")}>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" title="Adjuntar">
          <Paperclip className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" title="Emoji">
          <Smile className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" title="Plantillas" onClick={onOpenTemplates}>
          <Slash className="h-4 w-4" />
        </Button>
        <Button
          variant={internal ? "default" : "ghost"}
          size="icon"
          className={cn("h-9 w-9 shrink-0", internal && "bg-warning hover:bg-warning/90")}
          title="Nota interna"
          onClick={() => setInternal((v) => !v)}
        >
          <StickyNote className="h-4 w-4" />
        </Button>

        <div className="flex-1 relative">
          {aiDraftActive && (
            <div className="absolute -top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wide shadow-sm">
              <Sparkles className="h-2.5 w-2.5" />
              Borrador IA
              {onClearAiDraft && (
                <button
                  type="button"
                  onClick={onClearAiDraft}
                  className="ml-0.5 opacity-80 hover:opacity-100"
                  aria-label="Descartar borrador IA"
                >
                  ×
                </button>
              )}
            </div>
          )}
          <Textarea
            ref={taRef}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKey}
            placeholder={internal ? "Nota interna (no se envía al cliente)…" : "Escribe un mensaje…  ('/' para plantillas)"}
            rows={1}
            className={cn(
              "resize-none min-h-[36px] max-h-[160px] py-2 w-full",
              aiDraftActive && "border-primary/40 focus-visible:ring-primary",
            )}
          />
        </div>

        <Button onClick={submit} disabled={!draft.trim() || sending} size="icon" className="h-9 w-9 shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
