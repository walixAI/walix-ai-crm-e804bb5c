import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles, MessageCircle, KanbanSquare, StickyNote, CheckCircle2, Send, Phone, RefreshCw, Users, Mail, Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ContactRow, ActivityRow } from "@/lib/queries/contacts";
import { useContactSuggestions, useContactDeals, useContactTasks, useToggleContactTask } from "@/lib/queries/contacts";
import { QuickTaskDialog } from "@/components/pipeline/QuickTaskDialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** DD/MM/AA HH:MM:SS */
function fmtAbs(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Estatus visual de una tarea según su fecha de agenda */
function taskStatus(completed: boolean, dueAt?: string | null): { label: string; className: string } {
  if (completed) return { label: "Atendida", className: "bg-success/10 text-success border-success/20" };
  if (!dueAt) return { label: "Sin fecha", className: "bg-muted text-muted-foreground border-border" };
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return { label: "Sin fecha", className: "bg-muted text-muted-foreground border-border" };
  const now = new Date();
  if (due.getTime() < now.getTime()) return { label: "Vencida", className: "bg-destructive/10 text-destructive border-destructive/20" };
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (due < startOfTomorrow) return { label: "Hoy", className: "bg-warning/10 text-warning border-warning/20" };
  const in7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8);
  if (due < in7) return { label: "Próxima", className: "bg-info/10 text-info border-info/20" };
  return { label: "Pendiente", className: "bg-muted text-muted-foreground border-border" };
}

const iconMap: Record<string, { Icon: any; bg: string; color: string }> = {
  wa_sent: { Icon: MessageCircle, bg: "bg-success/10", color: "text-success" },
  wa_received: { Icon: MessageCircle, bg: "bg-info/10", color: "text-info" },
  note: { Icon: StickyNote, bg: "bg-info/10", color: "text-info" },
  deal: { Icon: KanbanSquare, bg: "bg-primary/10", color: "text-primary" },
  task: { Icon: CheckCircle2, bg: "bg-muted", color: "text-muted-foreground" },
  call: { Icon: Phone, bg: "bg-success/10", color: "text-success" },
  meeting: { Icon: Users, bg: "bg-primary/10", color: "text-primary" },
  email: { Icon: Mail, bg: "bg-info/10", color: "text-info" },
  manual: { Icon: MessageCircle, bg: "bg-muted", color: "text-muted-foreground" },
};

interface Props {
  contact: ContactRow;
  onWhatsApp: () => void;
  activity: ActivityRow[];
  onViewAllTasks?: () => void;
}

export function SummaryTab({ contact, onWhatsApp, activity, onViewAllTasks }: Props) {
  const { data: aiSuggestions, source } = useContactSuggestions(contact.id);
  const [searchParams] = useSearchParams();
  const focusDealId = searchParams.get("dealId");
  const { data: contactDeals = [] } = useContactDeals(contact.id);
  const { data: tasks = [] } = useContactTasks(contact.id);
  const toggleTask = useToggleContactTask(contact.id);
  const [taskPage, setTaskPage] = useState(0);
  const PAGE = 3;
  const pageCount = Math.max(1, Math.ceil(tasks.length / PAGE));
  const page = Math.min(taskPage, pageCount - 1);
  const pagedTasks = tasks.slice(page * PAGE, page * PAGE + PAGE);

  // When the user arrives from a dashboard widget with a specific deal in context,
  // pin that deal's suggestion on top so the async AI result never replaces it.
  const suggestions = useMemo(() => {
    if (!focusDealId) return aiSuggestions;
    const deal = contactDeals.find((d) => d.id === focusDealId);
    if (!deal) return aiSuggestions;
    const pinned = {
      id: `focus-${deal.id}`,
      text: `Estás aquí por la oportunidad "${deal.name}". Confirma el siguiente paso con ${contact.name?.split(" ")[0] ?? contact.name} para avanzarla al cierre.`,
      cta: "Escribir por WhatsApp",
      action: "whatsapp" as const,
      priority: 1000,
    };
    return [pinned, ...aiSuggestions.filter((s) => s.id !== pinned.id)];
  }, [focusDealId, contactDeals, aiSuggestions, contact.name]);

  const [index, setIndex] = useState(0);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState<string | undefined>(undefined);
  const top = suggestions[index % Math.max(suggestions.length, 1)];
  const recent = activity.slice(0, 5);

  const handlePrimary = () => {
    if (!top) return onWhatsApp();
    if (top.action === "whatsapp") return onWhatsApp();
    setTaskTitle(top.taskTitle ?? `Llamar a ${contact.name}`);
    setTaskOpen(true);
  };

  const handleScheduleCall = () => {
    setTaskTitle(`Llamada con ${contact.name}`);
    setTaskOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Tareas */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tareas {tasks.length > 0 && <span className="ml-1 text-muted-foreground/70">({tasks.length})</span>}
          </h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setTaskTitle(undefined); setTaskOpen(true); }}>
              <Plus className="h-3.5 w-3.5" /> Nueva
            </Button>
            {onViewAllTasks && (
              <Button variant="link" size="sm" className="h-7 text-xs px-1" onClick={onViewAllTasks}>
                Ver todas
              </Button>
            )}
          </div>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No hay tareas para este contacto.</p>
        ) : (
          <>
            <div className="divide-y divide-border">
              {pagedTasks.map((t) => (
                <div key={t.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                  <Checkbox
                    checked={t.completed}
                    className="mt-0.5"
                    onCheckedChange={(v) =>
                      toggleTask.mutate({ id: t.id, completed: !!v }, {
                        onError: (e: any) => toast.error(e.message ?? "Error"),
                      })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className={cn("text-sm truncate flex-1", t.completed && "line-through text-muted-foreground")}>
                        {t.title}
                      </div>
                      {(() => {
                        const st = taskStatus(t.completed, t.dueAt);
                        return (
                          <Badge variant="outline" className={cn("shrink-0 text-[10px] px-1.5 py-0 h-5 font-medium", st.className)}>
                            {st.label}
                          </Badge>
                        );
                      })()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Agenda: {fmtAbs(t.dueAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span>{page * PAGE + 1}–{page * PAGE + pagedTasks.length} de {tasks.length}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setTaskPage(page - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= pageCount - 1} onClick={() => setTaskPage(page + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Últimos eventos */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Últimos eventos</h3>
        <div className="relative">
          <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
          {recent.map(a => {
            const { Icon, bg, color } = iconMap[a.type] ?? iconMap.manual;
            const isTask = a.type === "task";
            const completed = !!a.metadata?.completed;
            const due = a.metadata?.dueAt as string | undefined;
            const overdue = isTask && !completed && due && new Date(due).getTime() < Date.now();
            return (
              <div key={a.id} className="relative flex gap-4 pb-4 last:pb-0">
                <div className={cn("relative z-10 h-9 w-9 rounded-full grid place-items-center shrink-0", bg)}>
                  <Icon className={cn("h-4 w-4", color)} />
                </div>
                <div className="flex-1 pt-1.5">
                  <div className={cn("text-sm", isTask && completed && "line-through text-muted-foreground")}>
                    {isTask ? "Tarea: " : ""}{a.description}
                    {isTask && completed && <span className="ml-2 text-[10px] uppercase text-success">completada</span>}
                    {overdue && <span className="ml-2 text-[10px] uppercase text-destructive">vencida</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px] bg-muted">{a.agentInitials}</AvatarFallback></Avatar>
                    <span>{a.agent}</span><span>·</span>
                    <span>Registrado: {fmtAbs(a.createdAt ?? a.timestamp)}</span>
                    {isTask && (<><span>·</span><span>Agenda: {fmtAbs(due ?? null)}</span></>)}
                  </div>
                </div>
              </div>
            );
          })}
          {recent.length === 0 && (
            <div className="text-sm text-muted-foreground italic">Aún no hay eventos.</div>
          )}
        </div>
      </div>

      {/* AI suggestion destacada */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent p-4 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-brand grid place-items-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">Próximo paso sugerido</span>
          {source === "ai" && (
            <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              IA
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed">
          {top?.text ?? `Sin sugerencias activas para ${contact.name} por ahora.`}
        </p>
        {(() => {
          const isCallCta = top?.action === "task";
          return (
        <div className="flex flex-wrap gap-2 mt-3">
          <Button onClick={handlePrimary} size="sm" className="bg-success hover:bg-success/90 text-success-foreground h-8">
            {isCallCta
              ? <Phone className="h-3.5 w-3.5" />
              : <Send className="h-3.5 w-3.5" />}
            {top?.cta ?? "Enviar por WhatsApp"}
          </Button>
          {!isCallCta && (
            <Button variant="outline" size="sm" className="h-8" onClick={handleScheduleCall}>
              <Phone className="h-3.5 w-3.5" /> Agendar llamada
            </Button>
          )}
          {suggestions.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => setIndex((i) => (i + 1) % suggestions.length)}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Otra sugerencia
            </Button>
          )}
        </div>
          );
        })()}
      </div>

      <QuickTaskDialog
        open={taskOpen}
        contactId={contact.id}
        defaultTitle={taskTitle}
        onClose={() => setTaskOpen(false)}
      />
    </div>
  );
}