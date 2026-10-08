import { useState } from "react";
import { Sparkles, X, Send, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ContactRow } from "@/lib/queries/contacts";
import { useContactSuggestions, useCreateContactActivity } from "@/lib/queries/contacts";
import { cn } from "@/lib/utils";
import { QuickTaskDialog } from "@/components/pipeline/QuickTaskDialog";
import { LeadAssistantPanel } from "@/components/walix/LeadAssistantPanel";

interface Props { contact: ContactRow; onWhatsApp: () => void }

export function AiFloatingPanel({ contact, onWhatsApp }: Props) {
  const [open, setOpen] = useState(false);
  const { data: suggestions } = useContactSuggestions(contact.id);
  const createActivity = useCreateContactActivity(contact.id);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState<string>("");
  const top = suggestions[0];
  const rest = suggestions.slice(1, 3);

  async function handleCta() {
    if (top.action === "whatsapp") return onWhatsApp();
    if (top.action === "task") {
      setTaskTitle(top.taskTitle ?? top.text.slice(0, 100));
      setTaskOpen(true);
      return;
    }
    if (top.action === "note") {
      const text = (top.noteText ?? top.text).trim();
      try {
        await createActivity.mutateAsync({ type: "note", description: text });
        toast.success("Nota guardada");
        setOpen(false);
      } catch (e: any) {
        toast.error(e.message ?? "Error");
      }
    }
  }

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
            <LeadAssistantPanel contactId={contact.id} compact overviewOnly />
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
      <QuickTaskDialog
        open={taskOpen}
        contactId={contact.id}
        defaultTitle={taskTitle}
        onClose={() => setTaskOpen(false)}
      />
    </div>
  );
}