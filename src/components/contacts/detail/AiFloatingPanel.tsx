import { useState } from "react";
import { Sparkles, X, Send, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContactRow } from "@/lib/queries/contacts";
import { useContactSuggestions } from "@/lib/queries/contacts";
import { cn } from "@/lib/utils";

interface Props { contact: ContactRow; onWhatsApp: () => void }

export function AiFloatingPanel({ contact, onWhatsApp }: Props) {
  const [open, setOpen] = useState(false);
  const { data: suggestions } = useContactSuggestions(contact.id);
  const top = suggestions[0];
  const rest = suggestions.slice(1, 3);

  // Hide entirely if there are no suggestions (defensive — buildContactSuggestions
  // always returns the fallback, but keep it safe).
  if (!top) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open ? (
        <div className="w-[360px] rounded-xl border border-border bg-card shadow-glow overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-brand grid place-items-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm">Walix IA</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
            <div className="rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 p-3 text-sm leading-relaxed">
              {top.text}
            </div>
            <Button
              onClick={top.action === "whatsapp" ? onWhatsApp : () => setOpen(false)}
              className="w-full bg-success hover:bg-success/90 text-success-foreground"
              size="sm"
            >
              <Send className="h-3.5 w-3.5" /> {top.cta}
            </Button>
            {rest.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Otras ideas</h4>
                <div className="space-y-2">
                  {rest.map((s) => (
                    <div key={s.id} className="text-xs p-2 rounded-lg bg-muted/40 flex items-center justify-between gap-2">
                      <span className="line-clamp-2">{s.text}</span>
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "h-12 w-12 rounded-full bg-gradient-brand text-primary-foreground grid place-items-center shadow-glow",
            "hover:scale-105 transition-transform"
          )}
          aria-label="Abrir asistente IA"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}