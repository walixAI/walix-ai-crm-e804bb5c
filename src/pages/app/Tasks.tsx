import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckSquare, Plus, Trash2, Calendar, User } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTasks, useToggleTask, useDeleteTask, type TaskView } from "@/lib/queries/tasks";
import { QuickTaskDialog } from "@/components/pipeline/QuickTaskDialog";
import { relativeTime } from "@/lib/format/relativeTime";
import { toast } from "sonner";

const VIEWS: { id: TaskView; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "upcoming", label: "Próximas" },
  { id: "overdue", label: "Vencidas" },
  { id: "completed", label: "Completadas" },
  { id: "all", label: "Todas" },
];

export default function TasksPage() {
  const [params, setParams] = useSearchParams();
  const initial = (params.get("view") as TaskView) || "today";
  const [view, setView] = useState<TaskView>(VIEWS.some(v => v.id === initial) ? initial : "today");
  const [mineOnly, setMineOnly] = useState(true);
  const [open, setOpen] = useState(false);
  const { data: tasks = [], isLoading } = useTasks({ view, mineOnly });
  const toggle = useToggleTask();
  const remove = useDeleteTask();

  const counts = useMemo(() => ({}), []);

  const setViewAndUrl = (v: string) => {
    setView(v as TaskView);
    setParams({ view: v });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tareas</h1>
          <p className="text-sm text-muted-foreground">Gestiona tus pendientes y los del equipo.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={mineOnly ? "default" : "outline"} size="sm" onClick={() => setMineOnly(!mineOnly)}>
            <User className="h-4 w-4" /> {mineOnly ? "Solo mías" : "Todas"}
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva tarea
          </Button>
        </div>
      </header>

      <Tabs value={view} onValueChange={setViewAndUrl}>
        <TabsList className="bg-card border border-border">
          {VIEWS.map((v) => (
            <TabsTrigger key={v.id} value={v.id}>{v.label}</TabsTrigger>
          ))}
        </TabsList>

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
                const overdue = t.dueAt && !t.completed && new Date(t.dueAt).getTime() < Date.now();
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
                      <div className={`text-sm ${t.completed ? "line-through text-muted-foreground" : ""}`}>
                        {t.title}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {t.dueAt && (
                          <span className={`inline-flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}>
                            <Calendar className="h-3 w-3" /> {relativeTime(t.dueAt)} {overdue && "· vencida"}
                          </span>
                        )}
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

      <QuickTaskDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}