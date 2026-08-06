import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronUp, History, MessageCircle, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useContact, useContactActivity } from "@/lib/queries/contacts";
import { useContactTasks } from "@/lib/queries/contacts";
import { buildDraftMessage } from "@/lib/tasks/closure";
import { ContactDetailSkeleton } from "@/components/walix/Skeletons";
import { relativeTime } from "@/lib/format/relativeTime";
import { SimpleContactHeader } from "@/components/contacts/simple/SimpleContactHeader";
import { PendingList } from "@/components/contacts/simple/PendingList";
import { QuickTourDialog, useContactSimpleTour } from "@/components/contacts/simple/QuickTourPopover";
import { blockWhatsappAction, useWhatsappChatEnabled, WHATSAPP_DISABLED_REASON } from "@/lib/whatsapp/featureFlags";

export default function ContactDetailSimple() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useContact(id);
  const { data: activity = [] } = useContactActivity(id);
  const { data: tasks = [] } = useContactTasks(id);
  const tour = useContactSimpleTour();
  const [showHistory, setShowHistory] = useState(false);

  if (isLoading) return <div className="p-6"><ContactDetailSkeleton /></div>;
  if (!contact) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-lg">Contacto no encontrado.</p>
      </div>
    );
  }

  const focusTaskId = params.get("focus") === "task" ? params.get("taskId") : null;
  const pending = tasks.filter((t) => !t.completed);
  const primaryTask =
    (focusTaskId && pending.find((t) => t.id === focusTaskId)) ||
    pending[0] ||
    null;
  const openWA = () => {
    if (blockWhatsappAction()) return;
    const params = new URLSearchParams({ contactId: contact.id });
    if (primaryTask) {
      const draft = buildDraftMessage(
        { title: primaryTask.title, task_kind: primaryTask.taskKind ?? null },
        { firstName: contact.name },
        null,
      );
      if (draft) params.set("draft", draft);
    }
    navigate(`/whatsapp?${params.toString()}`);
  };

  const recent = activity
    .filter((a) => a.type === "note" || a.type === "wa_sent" || a.type === "wa_received")
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-background -mx-4 md:-mx-6 -my-6 pb-16">
      <SimpleContactHeader contact={contact} onWhatsApp={openWA} onHelp={tour.show} />

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        <PendingList contactId={contact.id} focusTaskId={focusTaskId} />

        {recent.length > 0 && (
          <section className="rounded-2xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setShowHistory((s) => !s)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 rounded-2xl transition-colors"
            >
              <History className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <h3 className="text-base font-semibold">Historial reciente</h3>
                <p className="text-xs text-muted-foreground">
                  {showHistory ? "Ocultar" : `Ver los últimos ${recent.length} mensajes y notas`}
                </p>
              </div>
              {showHistory ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            {showHistory && (
              <ul className="px-5 pb-5 space-y-2">
                {recent.map((a) => {
                  const isNote = a.type === "note";
                  const Icon = isNote ? StickyNote : MessageCircle;
                  const iconColor = isNote ? "text-primary" : "text-success";
                  return (
                    <li key={a.id} className="text-sm border border-border rounded-lg p-3 bg-muted/30 flex gap-3">
                      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} />
                      <div className="min-w-0 flex-1">
                        <div className="whitespace-pre-wrap break-words">{a.description}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {isNote && a.agent ? `${a.agent} · ` : ""}{relativeTime(a.timestamp)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </main>

      <QuickTourDialog open={tour.open} onClose={tour.close} />
    </div>
  );
}