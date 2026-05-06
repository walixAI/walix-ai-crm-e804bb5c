import { Link } from "react-router-dom";
import { AlertTriangle, Calendar, ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useTasks, useToggleTask } from "@/lib/queries/tasks";
import { relativeTime } from "@/lib/format/relativeTime";
import { toast } from "sonner";

export function TaskCards() {
  const { data: overdue = [] } = useTasks({ view: "overdue", mineOnly: true });
  const { data: upcoming = [] } = useTasks({ view: "upcoming", mineOnly: true });
  const toggle = useToggleTask();

  const renderItem = (t: any, danger = false) => (
    <li key={t.id} className="flex items-start gap-2 py-2 border-b border-border last:border-0">
      <Checkbox
        checked={t.completed}
        className="mt-0.5"
        onCheckedChange={(c) => toggle.mutate({ id: t.id, completed: !!c }, { onError: (e: any) => toast.error(e.message ?? "Error") })}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{t.title}</div>
        <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
          {t.contactName && t.contactId && (
            <Link to={`/contacts/${t.contactId}`} className="text-primary hover:underline">{t.contactName}</Link>
          )}
          {t.dueAt && (
            <span className={danger ? "text-destructive" : ""}>{relativeTime(t.dueAt)}</span>
          )}
        </div>
      </div>
    </li>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section className="rounded-xl border border-destructive/30 bg-destructive/5 shadow-card p-4">
        <header className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" /> Tareas vencidas
            <span className="text-xs font-normal text-muted-foreground">({overdue.length})</span>
          </h3>
          <Link to="/tasks?view=overdue" className="text-xs text-primary inline-flex items-center gap-1">
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        {overdue.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">Sin vencidas. ¡Bien hecho!</p>
        ) : (
          <ul>{overdue.slice(0, 5).map((t) => renderItem(t, true))}</ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card shadow-card p-4">
        <header className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Próximas tareas (7d)
            <span className="text-xs font-normal text-muted-foreground">({upcoming.length})</span>
          </h3>
          <Link to="/tasks?view=upcoming" className="text-xs text-primary inline-flex items-center gap-1">
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">Sin tareas pendientes.</p>
        ) : (
          <ul>{upcoming.slice(0, 5).map((t) => renderItem(t))}</ul>
        )}
      </section>
    </div>
  );
}