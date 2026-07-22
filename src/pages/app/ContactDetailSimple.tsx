import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MessageCircle, StickyNote } from "lucide-react";
import { useContact, useContactActivity } from "@/lib/queries/contacts";
import { ContactDetailSkeleton } from "@/components/walix/Skeletons";
import { relativeTime } from "@/lib/format/relativeTime";
import { SimpleContactHeader } from "@/components/contacts/simple/SimpleContactHeader";
import { PendingList } from "@/components/contacts/simple/PendingList";
import { QuickTourDialog, useContactSimpleTour } from "@/components/contacts/simple/QuickTourPopover";

export default function ContactDetailSimple() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useContact(id);
  const { data: activity = [] } = useContactActivity(id);
  const tour = useContactSimpleTour();

  if (isLoading) return <div className="p-6"><ContactDetailSkeleton /></div>;
  if (!contact) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-lg">Contacto no encontrado.</p>
      </div>
    );
  }

  const focusTaskId = params.get("focus") === "task" ? params.get("taskId") : null;
  const openWA = () => navigate(`/whatsapp?contactId=${contact.id}`);

  const recentNotes = activity.filter((a) => a.type === "note").slice(0, 3);
  const recentMsgs = activity.filter((a) => a.type === "wa_sent" || a.type === "wa_received").slice(0, 3);

  return (
    <div className="min-h-screen bg-background -mx-4 md:-mx-6 -my-6 pb-16">
      <SimpleContactHeader contact={contact} onWhatsApp={openWA} onHelp={tour.show} />

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        <PendingList contactId={contact.id} focusTaskId={focusTaskId} />

        {recentMsgs.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="h-5 w-5 text-success" />
              <h3 className="text-lg font-bold">Últimos mensajes</h3>
            </div>
            <ul className="space-y-2">
              {recentMsgs.map((m) => (
                <li key={m.id} className="text-sm border border-border rounded-lg p-3 bg-muted/30">
                  <div className="whitespace-pre-wrap break-words">{m.description}</div>
                  <div className="text-xs text-muted-foreground mt-1">{relativeTime(m.timestamp)}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recentNotes.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <StickyNote className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold">Últimas notas</h3>
            </div>
            <ul className="space-y-2">
              {recentNotes.map((n) => (
                <li key={n.id} className="text-sm border border-border rounded-lg p-3 bg-muted/30">
                  <div className="whitespace-pre-wrap break-words">{n.description}</div>
                  <div className="text-xs text-muted-foreground mt-1">{n.agent} · {relativeTime(n.timestamp)}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <QuickTourDialog open={tour.open} onClose={tour.close} />
    </div>
  );
}