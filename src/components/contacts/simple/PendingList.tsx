import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, Calendar, CheckCircle2, ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useContactTasks } from "@/lib/queries/contacts";
import { QuickTaskDialog } from "@/components/pipeline/QuickTaskDialog";
import { CloseTaskDialog } from "./CloseTaskDialog";

interface Props {
  contactId: string;
  focusTaskId?: string | null;
}

export function PendingList({ contactId, focusTaskId }: Props) {
  const { data: tasks = [] } = useContactTasks(contactId);
  const [closing, setClosing] = useState<{ id: string; title: string; taskKind: string | null; dueAt: string | null } | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const pending = useMemo(
    () => tasks
      .filter((t) => !t.completed)
      .sort((a, b) => {
        const at = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
        const bt = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
        return at - bt;
      }),
    [tasks],
  );

  return (
    <section className="rounded-2xl border-2 border-border bg-card shadow-card">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <ClipboardList className="h-7 w-7 text-primary" />
        <h2 className="text-2xl font-bold">Qué tienes que hacer</h2>
        <span className="ml-auto text-lg text-muted-foreground">{pending.length}</span>
      </div>

      <div className="p-3 space-y-2">
        {pending.length === 0 && (
          <div className="text-center py-10 space-y-3">
            <CheckCircle2 className="h-14 w-14 mx-auto text-success" />
            <p className="text-lg text-muted-foreground">¡Nada pendiente con este contacto!</p>
          </div>
        )}

        {pending.map((t) => {
          const overdue = t.dueAt ? new Date(t.dueAt).getTime() < Date.now() : false;
          const highlight = focusTaskId === t.id;
          return (
            <div
              key={t.id}
              className={`rounded-xl border-2 p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${
                highlight ? "border-primary bg-primary/5 ring-2 ring-primary/30" :
                overdue ? "border-destructive/50 bg-destructive/5" : "border-border"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-lg font-semibold">{t.title}</div>
                {t.dueAt && (
                  <div className={`text-sm mt-1 flex items-center gap-1.5 ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    {overdue ? <AlertCircle className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                    {format(new Date(t.dueAt), "PPp", { locale: es })}
                  </div>
                )}
              </div>
              <Button
                size="lg"
                className="h-12 text-base shrink-0"
                onClick={() => setClosing({ id: t.id, title: t.title, taskKind: t.taskKind ?? null, dueAt: t.dueAt })}
              >
                <CheckCircle2 className="mr-2 h-5 w-5" /> Marcar hecha
              </Button>
            </div>
          );
        })}

        <Button
          variant="outline"
          size="lg"
          className="w-full h-12 mt-2 text-base"
          onClick={() => setNewOpen(true)}
        >
          <Plus className="mr-2 h-5 w-5" /> Nueva tarea
        </Button>
      </div>

      <CloseTaskDialog
        open={!!closing}
        onOpenChange={(o) => !o && setClosing(null)}
        contactId={contactId}
        task={closing}
      />
      <QuickTaskDialog
        open={newOpen}
        contactId={contactId}
        onClose={() => setNewOpen(false)}
      />
    </section>
  );
}