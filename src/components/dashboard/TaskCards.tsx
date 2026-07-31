import { useNavigate } from "react-router-dom";
import { AlertTriangle, Calendar, ArrowRight, ChevronRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTasks, type TaskRow } from "@/lib/queries/tasks";
import { relativeTime } from "@/lib/format/relativeTime";

export function TaskCards() {
  const navigate = useNavigate();
  // Tenant-wide (not mineOnly): the dashboard shows the whole team.
  const { data: overdue = [] } = useTasks({ view: "overdue" });
  const { data: upcoming = [] } = useTasks({ view: "upcoming" });

  const open = (t: TaskRow) => {
    // Siempre priorizamos la persona: el gestor trabaja sobre el contacto.
    if (t.contactId) navigate(`/contacts/${t.contactId}?focus=tasks`);
    else if (t.dealId) navigate(`/pipeline?dealId=${t.dealId}#tareas`);
    else navigate("/tasks?view=overdue");
  };

  const renderItem = (t: TaskRow, danger = false) => (
    <li key={t.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{t.title}</div>
        <div className="text-xs text-muted-foreground flex gap-2 flex-wrap items-center mt-0.5">
          {t.contactName && <span className="truncate">{t.contactName}</span>}
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" /> {t.assigneeName}
          </span>
          {t.dueAt && <span className={danger ? "text-destructive font-medium" : ""}>{relativeTime(t.dueAt)}</span>}
        </div>
      </div>
      <Button
        size="sm"
        variant={danger ? "destructive" : "outline"}
        className="h-7 gap-1 text-xs shrink-0"
        onClick={() => open(t)}
      >
        Atender <ChevronRight className="h-3 w-3" />
      </Button>
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
          <button onClick={() => navigate("/tasks?view=overdue")} className="text-xs text-primary inline-flex items-center gap-1">
            Ver todas <ArrowRight className="h-3 w-3" />
          </button>
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
            <Calendar className="h-4 w-4 text-primary" /> Próximas tareas (30d)
            <span className="text-xs font-normal text-muted-foreground">({upcoming.length})</span>
          </h3>
          <button onClick={() => navigate("/tasks?view=upcoming")} className="text-xs text-primary inline-flex items-center gap-1">
            Ver todas <ArrowRight className="h-3 w-3" />
          </button>
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
