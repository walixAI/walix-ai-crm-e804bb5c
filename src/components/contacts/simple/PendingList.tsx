import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, Calendar, CheckCircle2, ClipboardList, Plus, Lightbulb, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useContact, useContactTasks } from "@/lib/queries/contacts";
import { QuickTaskDialog } from "@/components/pipeline/QuickTaskDialog";
import { CloseTaskDialog } from "./CloseTaskDialog";
import { suggestedChannel } from "@/lib/tasks/closure";

interface Props {
  contactId: string;
  focusTaskId?: string | null;
}

const KIND_HINT: Record<string, { title: string; hint: string; cta: string }> = {
  cotizacion: {
    title: "Envíale la cotización",
    hint: "Toca el botón verde para mandarle por WhatsApp un mensaje con la cotización ya lista. Solo revisa y presiona enviar.",
    cta: "Cotizar ahora",
  },
  cobro: {
    title: "Pídele el pago con amabilidad",
    hint: "Toca el botón para enviarle un WhatsApp recordándole el pago pendiente. El mensaje ya está redactado.",
    cta: "Cobrar ahora",
  },
  seguimiento: {
    title: "Dale seguimiento",
    hint: "Escríbele por WhatsApp para saber cómo va. El mensaje ya está preparado — solo revisa y envía.",
    cta: "Dar seguimiento",
  },
  servicio: {
    title: "Confirma la visita",
    hint: "Registra si ya visitaste al cliente o confirma el horario por WhatsApp.",
    cta: "Registrar servicio",
  },
  refaccion: {
    title: "Avísale de la refacción",
    hint: "Mándale por WhatsApp el aviso de que la refacción está lista o pendiente.",
    cta: "Avisar",
  },
  facturacion: {
    title: "Pídele datos de factura",
    hint: "Solicítale por WhatsApp los datos fiscales para emitir la factura.",
    cta: "Pedir datos",
  },
  queja: {
    title: "Llámale de inmediato",
    hint: "Es mejor llamar. Registra el resultado de la llamada al terminar.",
    cta: "Registrar llamada",
  },
  devolucion: {
    title: "Coordina la devolución",
    hint: "Llama al cliente para acordar la devolución o el cambio.",
    cta: "Registrar llamada",
  },
};

function hintFor(taskKind: string | null, title: string) {
  const k = (taskKind ?? "").toLowerCase();
  if (KIND_HINT[k]) return KIND_HINT[k];
  // Heurística por título si no hay task_kind claro
  const t = title.toLowerCase();
  if (/cotiz|presupuesto|precio/.test(t)) return KIND_HINT.cotizacion;
  if (/pago|cobr|factura|saldo/.test(t)) return KIND_HINT.cobro;
  if (/seguim|reactiv|llamar|contact/.test(t)) return KIND_HINT.seguimiento;
  if (/visit|manten|instal|servicio/.test(t)) return KIND_HINT.servicio;
  return {
    title: "¿Cómo la resolviste?",
    hint: "Toca el botón para elegir cómo se hizo (WhatsApp, llamada u otro) y dejarla registrada.",
    cta: "Marcar hecha",
  };
}

export function PendingList({ contactId, focusTaskId }: Props) {
  const { data: tasks = [] } = useContactTasks(contactId);
  const { data: contact } = useContact(contactId);
  const [closing, setClosing] = useState<{ id: string; title: string; taskKind: string | null; dueAt: string | null } | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const pending = useMemo(
    () => tasks
      .filter((t) => !t.completed)
      .sort((a, b) => {
        // El foco siempre sube al inicio
        if (focusTaskId && a.id === focusTaskId) return -1;
        if (focusTaskId && b.id === focusTaskId) return 1;
        const at = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
        const bt = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
        return at - bt;
      }),
    [tasks, focusTaskId],
  );

  // Auto-abre el diálogo de cierre cuando llegamos con foco a una tarea concreta.
  const [autoOpened, setAutoOpened] = useState<string | null>(null);
  useEffect(() => {
    if (!focusTaskId || autoOpened === focusTaskId) return;
    const t = pending.find((x) => x.id === focusTaskId);
    if (!t) return;
    setAutoOpened(focusTaskId);
    setClosing({ id: t.id, title: t.title, taskKind: t.taskKind ?? null, dueAt: t.dueAt });
  }, [focusTaskId, pending, autoOpened]);

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
          const hint = hintFor(t.taskKind ?? null, t.title);
          const channel = suggestedChannel(t.taskKind);
          return (
            <div
              key={t.id}
              className={`rounded-xl border-2 p-4 transition-colors ${
                highlight ? "border-primary bg-primary/5 ring-2 ring-primary/30" :
                overdue ? "border-destructive/50 bg-destructive/5" : "border-border"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
                  {hint.cta} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>

              {highlight && (
                <div className="mt-3 rounded-lg bg-background border border-primary/30 p-3 flex gap-3">
                  <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-semibold text-primary">{hint.title}</div>
                    <div className="text-muted-foreground mt-0.5">{hint.hint}</div>
                    <div className="text-xs text-muted-foreground mt-1.5">
                      Sugerido: {channel === "whatsapp" ? "WhatsApp" : channel === "call" ? "Llamada" : "Registrar nota"}
                    </div>
                  </div>
                </div>
              )}
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
        contact={contact ? { firstName: contact.name, name: `${contact.name}${contact.lastName ? " " + contact.lastName : ""}` } : null}
      />
      <QuickTaskDialog
        open={newOpen}
        contactId={contactId}
        onClose={() => setNewOpen(false)}
      />
    </section>
  );
}