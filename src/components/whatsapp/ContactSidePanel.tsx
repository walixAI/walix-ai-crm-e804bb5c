import { Link } from "react-router-dom";
import { ExternalLink, Plus, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useContactDeals } from "@/lib/queries/contacts";
import {
  useContactActivity, useContactTasks,
  useCreateContactActivity, useToggleContactTask,
} from "@/lib/queries/contacts";
import { Checkbox } from "@/components/ui/checkbox";
import { QuickTaskDialog } from "@/components/pipeline/QuickTaskDialog";
import { relativeTime } from "@/lib/format/relativeTime";
import type { ConversationItem } from "@/lib/queries/whatsapp";

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

interface Props {
  conv: ConversationItem;
  notesDraft: string;
  onNotesChange: (v: string) => void;
  onSaveNotes: () => void;
  onLinkDeal: () => void;
}

export function ContactSidePanel({ conv, notesDraft, onNotesChange, onSaveNotes, onLinkDeal }: Props) {
  const { data: deals } = useContactDeals(conv.contactId);
  const { data: activity = [] } = useContactActivity(conv.contactId);
  const { data: tasks = [] } = useContactTasks(conv.contactId);
  const createActivity = useCreateContactActivity(conv.contactId);
  const toggleTask = useToggleContactTask(conv.contactId);
  const [contactNote, setContactNote] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);

  const notes = activity.filter((a) => a.type === "note").slice(0, 5);
  const pendingTasks = tasks.filter((t) => !t.completed).slice(0, 5);

  async function saveContactNote() {
    const t = contactNote.trim();
    if (!t) return;
    try {
      await createActivity.mutateAsync({ type: "note", description: t });
      setContactNote("");
      toast.success("Nota guardada");
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    }
  }

  return (
    <aside className="w-[320px] shrink-0 border-l border-border bg-card hidden lg:flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Contact card */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contacto</h3>
            <div className="border border-border rounded-lg p-3 space-y-2">
              <Link
                to={`/contacts/${conv.contactId}`}
                className="flex items-center gap-3 group rounded-md -m-1 p-1 hover:bg-muted/50 transition"
              >
                <div
                  className="h-10 w-10 rounded-full text-white text-xs font-semibold flex items-center justify-center"
                  style={{ background: conv.avatarColor }}
                >
                  {conv.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate group-hover:text-primary group-hover:underline transition">
                    {conv.contactName}
                  </p>
                  {conv.contactCompany && (
                    <p className="text-xs text-muted-foreground truncate">{conv.contactCompany}</p>
                  )}
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </Link>
              <div className="text-xs text-muted-foreground">{conv.contactPhone}</div>
              <div className="text-xs">
                Estado: <span className="font-medium">{conv.contactStatus}</span>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full h-8 text-xs">
                <Link to={`/contacts/${conv.contactId}`}>
                  <ExternalLink className="h-3 w-3 mr-1.5" />
                  Ver perfil completo
                </Link>
              </Button>
            </div>
          </section>

          {/* Deals */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Deals vinculados
            </h3>
            <div className="space-y-2">
              {(deals ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Sin deals aún</p>
              )}
              {(deals ?? []).map((d) => (
                <Link
                  key={d.id}
                  to={`/contacts/${conv.contactId}?dealId=${d.id}`}
                  className="block border border-border rounded-lg p-2.5 transition hover:border-primary/40 hover:bg-muted/40 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium truncate">{d.name}</p>
                    <span className="text-xs font-semibold text-primary shrink-0">{fmt(d.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-[11px] text-muted-foreground truncate">{d.stage}</p>
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
              <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={onLinkDeal}>
                <Plus className="h-3 w-3 mr-1" />
                Vincular o crear deal
              </Button>
            </div>
          </section>

          {/* Notes */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notas rápidas</h3>
            <Textarea
              value={notesDraft}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Agrega una nota interna…"
              rows={4}
              className="text-xs"
            />
            <Button onClick={onSaveNotes} variant="outline" size="sm" className="w-full h-8 text-xs mt-2">
              Guardar nota
            </Button>
          </section>

          {/* Notas del contacto */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Notas del contacto
            </h3>
            <Textarea
              value={contactNote}
              onChange={(e) => setContactNote(e.target.value)}
              placeholder="Nota persistente del contacto…"
              rows={3}
              className="text-xs"
              maxLength={2000}
            />
            <Button
              onClick={saveContactNote}
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs mt-2"
              disabled={createActivity.isPending || !contactNote.trim()}
            >
              {createActivity.isPending ? "Guardando…" : "Guardar en contacto"}
            </Button>
            {notes.length > 0 && (
              <div className="mt-3 space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="text-[11px] border border-border rounded-md p-2 bg-muted/30">
                    <div className="whitespace-pre-wrap break-words">{n.description}</div>
                    <div className="text-muted-foreground mt-1">
                      {n.agent} · {relativeTime(n.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tareas */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Tareas
            </h3>
            <div className="space-y-2">
              {pendingTasks.length === 0 && (
                <p className="text-xs text-muted-foreground">Sin tareas pendientes</p>
              )}
              {pendingTasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2 border border-border rounded-md p-2">
                  <Checkbox
                    checked={t.completed}
                    onCheckedChange={(v) => toggleTask.mutate({ id: t.id, completed: !!v })}
                    className="mt-0.5"
                  />
                  <div className="flex-1 text-[11px]">
                    <div>{t.title}</div>
                    {t.dueAt && (
                      <div className="text-muted-foreground mt-0.5">
                        {new Date(t.dueAt).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <Button
                variant="outline" size="sm"
                className="w-full h-8 text-xs"
                onClick={() => setTaskOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" /> Nueva tarea
              </Button>
            </div>
          </section>
        </div>
      </ScrollArea>

      <QuickTaskDialog
        open={taskOpen}
        contactId={conv.contactId}
        onClose={() => setTaskOpen(false)}
      />
    </aside>
  );
}
