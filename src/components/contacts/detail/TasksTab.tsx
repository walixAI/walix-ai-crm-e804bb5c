import { useState } from "react";
import { toast } from "sonner";
import { CheckSquare, Plus, Trash2, Calendar, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useContactTasks,
  useToggleContactTask,
  useDeleteContactTask,
} from "@/lib/queries/contacts";
import { QuickTaskDialog } from "@/components/pipeline/QuickTaskDialog";

interface Props { contactId: string }

function fmtDue(iso: string | null) {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  return d.toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function badge(t: { completed: boolean; dueAt: string | null }) {
  if (t.completed) return { label: "Completada", cls: "bg-success/10 text-success border-success/20" };
  if (!t.dueAt) return { label: "Sin fecha", cls: "bg-muted text-muted-foreground border-border" };
  const ms = new Date(t.dueAt).getTime();
  const now = Date.now();
  if (ms < now) return { label: "Vencida", cls: "bg-destructive/10 text-destructive border-destructive/30" };
  const eod = new Date(); eod.setHours(23, 59, 59, 999);
  if (ms <= eod.getTime()) return { label: "Hoy", cls: "bg-warning/10 text-warning border-warning/30" };
  return { label: "Próxima", cls: "bg-primary/10 text-primary border-primary/20" };
}

export function TasksTab({ contactId }: Props) {
  const { data: tasks = [] } = useContactTasks(contactId);
  const toggle = useToggleContactTask(contactId);
  const remove = useDeleteContactTask(contactId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nueva tarea
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-card">
          <CheckSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No hay tareas para este contacto.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border shadow-card">
          {tasks.map((t) => {
            const b = badge(t);
            return (
              <div key={t.id} className="p-3 flex items-start gap-3 group">
                <Checkbox
                  checked={t.completed}
                  onCheckedChange={(v) =>
                    toggle.mutate({ id: t.id, completed: !!v }, {
                      onError: (e: any) => toast.error(e.message ?? "Error"),
                    })
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`text-sm ${t.completed ? "line-through text-muted-foreground" : ""}`}>
                      {t.title} <span className="text-muted-foreground">· {t.dealName ?? "Sin oportunidad"}</span>
                    </div>
                    <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${b.cls}`}>
                      {b.label}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5 flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" /> {fmtDue(t.dueAt)}
                  </div>
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  onClick={() => { setEditing(t); setOpen(true); }}
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  onClick={() => {
                    if (confirm("¿Eliminar esta tarea?")) {
                      remove.mutate(t.id, {
                        onSuccess: () => toast.success("Tarea eliminada"),
                        onError: (e: any) => toast.error(e.message ?? "Error"),
                      });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <QuickTaskDialog
        open={open}
        contactId={contactId}
        onClose={() => { setOpen(false); setEditing(null); }}
        task={editing ? {
          id: editing.id,
          title: editing.title,
          dueAt: editing.dueAt,
          assigneeId: editing.assigneeId,
          contactId: contactId,
          dealId: editing.dealId,
        } : null}
      />
    </div>
  );
}