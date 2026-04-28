import { useEffect, useRef, useState } from "react";
import { Paperclip, Smile, Send, StickyNote, Sparkles, FileText, Slash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { MessageTemplate } from "@/lib/queries/whatsapp";

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
}

export function Composer({
  draft, onDraftChange, templates, onSend, sending,
  onAiSuggest, onAiSummarize, onAiPrompt, aiLoading,
  onOpenTemplates, onPickTemplate,
}: Props) {
  const [internal, setInternal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [tplFilter, setTplFilter] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

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
      {/* AI bar */}
      <div className="bg-primary/5 border-b border-primary/10 px-3 py-2 flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5 hover:bg-primary/10" onClick={onAiSuggest} disabled={aiLoading}>
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Sugerir respuesta
        </Button>
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
      <div className={cn("p-3 flex items-end gap-2", internal && "bg-warning/5")}>
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

        <Textarea
          ref={taRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onKey}
          placeholder={internal ? "Nota interna (no se envía al cliente)…" : "Escribe un mensaje…  ('/' para plantillas)"}
          rows={1}
          className="flex-1 resize-none min-h-[36px] max-h-[160px] py-2"
        />

        <Button onClick={submit} disabled={!draft.trim() || sending} size="icon" className="h-9 w-9 shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
