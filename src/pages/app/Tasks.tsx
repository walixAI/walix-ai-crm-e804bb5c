import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckSquare, Plus, Trash2, Calendar, User, Pencil } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTasks, useToggleTask, useDeleteTask, type TaskRow, type TaskView } from "@/lib/queries/tasks";
import { QuickTaskDialog } from "@/components/pipeline/QuickTaskDialog";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { AiProposalsPanel } from "@/components/walix/AiProposalsPanel";
import { usePendingProposalsCount } from "@/lib/queries/aiProposals";

const VIEWS: { id: TaskView; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "upcoming", label: "Próximas" },
  { id: "overdue", label: "Vencidas" },
  { id: "completed", label: "Completadas" },
  { id: "all", label: "Todas" },
];

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Sin fecha";
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function statusBadge(t: TaskRow): { label: string; cls: string } {
  if (t.completed) return { label: "Completada", cls: "bg-success/10 text-success border-success/20" };
  if (!t.dueAt) return { label: "Sin fecha", cls: "bg-muted text-muted-foreground border-border" };
  const ms = new Date(t.dueAt).getTime();
  const now = Date.now();
  if (ms < now) return { label: "Vencida", cls: "bg-destructive/10 text-destructive border-destructive/30" };
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
  if (ms <= endOfDay.getTime()) return { label: "Hoy", cls: "bg-warning/10 text-warning border-warning/30" };
  return { label: "Próxima", cls: "bg-primary/10 text-primary border-primary/20" };
}

export default function TasksPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("view") || "today";
  const [tab, setTab] = useState<string>(
    initial === "proposals" || VIEWS.some(v => v.id === initial) ? initial : "today",
  );
  const view: TaskView = (tab === "proposals" ? "today" : tab) as TaskView;
  const { isTenantAdmin, isManager, isPlatform } = usePermissions();
  const canSeeAll = isTenantAdmin || isManager || isPlatform;
  const [mineOnly, setMineOnly] = useState(!canSeeAll);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const { data: tasks = [], isLoading } = useTasks({ view, mineOnly: canSeeAll ? mineOnly : true });
  const toggle = useToggleTask();
  const remove = useDeleteTask();
  const { total: proposalsCount } = usePendingProposalsCount();

  const counts = useMemo(() => ({}), []);

  const setViewAndUrl = (v: string) => {
    setTab(v);
    setParams({ view: v });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tareas</h1>
          <p className="text-sm text-muted-foreground">
            {canSeeAll ? "Gestiona tus pendientes y los del equipo." : "Gestiona tus pendientes."}
          </p>
        </div>
        <div className="flex gap-2">
          {canSeeAll && (
            <Button variant={mineOnly ? "default" : "outline"} size="sm" onClick={() => setMineOnly(!mineOnly)}>
              <User className="h-4 w-4" /> {mineOnly ? "Solo mías" : "De todos"}
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Nueva tarea
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setViewAndUrl}>
        <TabsList className="bg-card border border-border flex-wrap h-auto">
          {VIEWS.map((v) => (
            <TabsTrigger key={v.id} value={v.id}>{v.label}</TabsTrigger>
          ))}
          <TabsTrigger value="proposals" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Propuestas
            {proposalsCount > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {proposalsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Walix IA detectó estos pendientes. Acepta para crear la tarea real o rechaza para descartarla.
          </p>
          <AiProposalsPanel variant="list" />
        </TabsContent>


        {VIEWS.map((v) => (
          <TabsContent key={v.id} value={v.id} className="mt-4">
            <div className="rounded-xl border border-border bg-card divide-y divide-border shadow-card">
              {isLoading && <div className="p-6 text-sm text-muted-foreground">Cargando…</div>}
              {!isLoading && tasks.length === 0 && (
                <div className="p-12 text-center">
                  <CheckSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No hay tareas en esta vista.</p>
                </div>
              )}
              {tasks.map((t) => {
                const badge = statusBadge(t);
                return (
                  <div key={t.id} className="p-3 flex items-start gap-3 group">
                    <Checkbox
                      checked={t.completed}
                      className="mt-0.5"
                      onCheckedChange={(c) =>
                        toggle.mutate({ id: t.id, completed: !!c }, {
                          onError: (e: any) => toast.error(e.message ?? "Error"),
                        })
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`text-sm ${t.completed ? "line-through text-muted-foreground" : ""}`}>
                          {t.title}
                        </div>
                        <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {fmtDateTime(t.dueAt)}
                        </span>
                        {t.contactId && t.contactName && (
                          <Link to={`/contacts/${t.contactId}`} className="text-primary hover:underline">
                            {t.contactName}
                          </Link>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px] bg-muted">{t.assigneeInitials}</AvatarFallback></Avatar>
                          {t.assigneeName}
                        </span>
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
          </TabsContent>
        ))}
      </Tabs>

      <QuickTaskDialog
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        task={editing ? {
          id: editing.id,
          title: editing.title,
          dueAt: editing.dueAt,
          assigneeId: editing.assigneeId,
          contactId: editing.contactId,
          dealId: editing.dealId,
        } : null}
      />
    </div>
  );
}