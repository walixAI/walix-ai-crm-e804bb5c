import { Sparkles, MessageCircle, KanbanSquare, StickyNote, CheckCircle2, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format/relativeTime";
import type { ContactRow, ActivityRow } from "@/lib/queries/contacts";
import { useContactAiSuggestions } from "@/lib/queries/contacts";
import { cn } from "@/lib/utils";

const iconMap = {
  wa_sent: { Icon: MessageCircle, bg: "bg-success/10", color: "text-success" },
  wa_received: { Icon: MessageCircle, bg: "bg-info/10", color: "text-info" },
  note: { Icon: StickyNote, bg: "bg-info/10", color: "text-info" },
  deal: { Icon: KanbanSquare, bg: "bg-primary/10", color: "text-primary" },
  task: { Icon: CheckCircle2, bg: "bg-muted", color: "text-muted-foreground" },
};

interface Props { contact: ContactRow; onWhatsApp: () => void; activity: ActivityRow[] }

export function SummaryTab({ contact, onWhatsApp, activity }: Props) {
  const { data: suggestions = [] } = useContactAiSuggestions(contact.id);
  const top = suggestions[0];
  const recent = activity.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* AI suggestion destacada */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent p-4 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-brand grid place-items-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">Próximo paso sugerido</span>
        </div>
        <p className="text-sm leading-relaxed">
          {top ? top.text : `Sin sugerencias activas para ${contact.name} por ahora.`}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button onClick={onWhatsApp} size="sm" className="bg-success hover:bg-success/90 text-success-foreground h-8">
            <Send className="h-3.5 w-3.5" /> {top?.cta ?? "Enviar por WhatsApp"}
          </Button>
          <Button variant="outline" size="sm" className="h-8">Agendar llamada</Button>
          <Button variant="ghost" size="sm" className="h-8">Otra sugerencia</Button>
        </div>
      </div>

      {/* Últimos eventos */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Últimos eventos</h3>
        <div className="relative">
          <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
          {recent.map(a => {
            const { Icon, bg, color } = iconMap[a.type];
            return (
              <div key={a.id} className="relative flex gap-4 pb-4 last:pb-0">
                <div className={cn("relative z-10 h-9 w-9 rounded-full grid place-items-center shrink-0", bg)}>
                  <Icon className={cn("h-4 w-4", color)} />
                </div>
                <div className="flex-1 pt-1.5">
                  <div className="text-sm">{a.description}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px] bg-muted">{a.agentInitials}</AvatarFallback></Avatar>
                    <span>{a.agent}</span><span>·</span><span>{relativeTime(a.timestamp)}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {recent.length === 0 && (
            <div className="text-sm text-muted-foreground italic">Aún no hay eventos.</div>
          )}
        </div>
      </div>
    </div>
  );
}