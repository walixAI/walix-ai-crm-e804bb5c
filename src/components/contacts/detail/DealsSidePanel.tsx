import { useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { useContactDeals, useContactTasks } from "@/lib/queries/contacts";
import { QuickTaskDialog } from "@/components/pipeline/QuickTaskDialog";
import { cn } from "@/lib/utils";

interface Props { contactId: string }

function fmtDue(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function DealsSidePanel({ contactId }: Props) {
  const { data: deals = [] } = useContactDeals(contactId);
  const { data: tasks = [] } = useContactTasks(contactId);
  const [taskOpen, setTaskOpen] = useState(false);
  const now = Date.now();
  const upcoming = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const ax = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const bx = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
      return ax - bx;
    })
    .slice(0, 5);
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Oportunidades</span>
          <button className="text-muted-foreground hover:text-primary transition-colors"><Plus className="h-3.5 w-3.5" /></button>
        </div>
        <div className="p-3 space-y-2">
          {deals.map(d => (
            <div key={d.id} className="p-3 rounded-lg border border-border hover:border-primary/40 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm leading-tight">{d.name}</div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0 whitespace-nowrap">{d.stage}</span>
              </div>
              <div className="text-lg font-bold text-gradient-brand mt-1">${d.amount.toLocaleString("es-MX")}</div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 mb-1">
                <span>Probabilidad</span><span className="font-semibold">{d.probability}%</span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-brand" style={{ width: `${d.probability}%` }} />
              </div>
            </div>
          ))}
          {deals.length === 0 && (
            <div className="text-xs text-muted-foreground italic text-center py-4">Sin deals activos</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Próximas tareas</span>
          <button onClick={() => setTaskOpen(true)} className="text-muted-foreground hover:text-primary transition-colors"><Plus className="h-3.5 w-3.5" /></button>
        </div>
        <div className="p-3 space-y-2">
          {upcoming.length === 0 ? (
            <div className="text-xs text-muted-foreground italic text-center py-4">Sin tareas pendientes</div>
          ) : (
            upcoming.map((t) => {
              const due = t.dueAt ? new Date(t.dueAt).getTime() : null;
              const overdue = due !== null && due < now;
              return (
                <div key={t.id} className="flex items-start gap-2 text-sm p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{t.title}</div>
                    <div className={cn("text-[10px] mt-0.5", overdue ? "text-destructive" : "text-muted-foreground")}>
                      {due === null ? "Sin fecha" : `${fmtDue(t.dueAt)}${overdue ? " · vencida" : ""}`}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <QuickTaskDialog open={taskOpen} contactId={contactId} onClose={() => setTaskOpen(false)} />
    </div>
  );
}