import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles, RefreshCw, Copy, Send, Phone, MessageCircle, CalendarClock, Mail, ListTodo, ArrowRightLeft, Hourglass,
  AlertTriangle, ChevronDown, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLeadAssistant, type LeadBrief } from "@/lib/queries/leadAssistant";
import { relativeTime } from "@/lib/format/relativeTime";

const ACTION_ICON: Record<string, typeof Phone> = {
  whatsapp: MessageCircle, call: Phone, meeting: CalendarClock, email: Mail, task: ListTodo, move_stage: ArrowRightLeft, wait: Hourglass,
};
const tone = (v: string) =>
  v === "alta" || v === "Alta" || v === "danger" ? "bg-destructive/10 text-destructive border-destructive/30"
    : v === "media" || v === "Media" || v === "warning" ? "bg-warning/15 text-warning border-warning/30"
      : "bg-primary/10 text-primary border-primary/30";

interface Props {
  contactId: string;
  /** Cambia cuando hay mensajes/actividad nueva para actualizar sola. */
  signal?: string | number | null;
  /** Si se pasa, los mensajes muestran "Usar" para llenar el chat. */
  onUseMessage?: (text: string) => void;
  compact?: boolean;
  hideProbability?: boolean;
}

export function LeadAssistantPanel({ contactId, signal, onUseMessage, compact, hideProbability }: Props) {
  const { data, isLoading, isFetching, error, regenerate } = useLeadAssistant(contactId, signal);
  const [busy, setBusy] = useState(false);
  const b = data?.brief;

  const refresh = async () => {
    setBusy(true);
    try { await regenerate(); toast.success("Asesoría actualizada"); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const spinning = busy || isFetching;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-gradient-brand grid place-items-center">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">Asistente del lead</div>
          <div className="text-[11px] text-muted-foreground">
            {spinning ? "Analizando conversación y actividades…" : data ? `Actualizado ${relativeTime(data.generated_at)} · se actualiza solo` : "Se actualiza solo con cada novedad"}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refresh} disabled={spinning} aria-label="Actualizar">
          <RefreshCw className={cn("h-3.5 w-3.5", spinning && "animate-spin")} />
        </Button>
      </div>

      {isLoading && !b && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
        </div>
      )}
      {error && !b && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {(error as Error).message}
        </div>
      )}
      {b && <BriefView b={b} onUseMessage={onUseMessage} compact={compact} hideProbability={hideProbability} />}
    </div>
  );
}

function BriefView({ b, onUseMessage, compact, hideProbability }: { b: LeadBrief; onUseMessage?: (t: string) => void; compact?: boolean; hideProbability?: boolean }) {
  const Icon = ACTION_ICON[b.next_step.action] ?? Target;
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Mensaje copiado"); };

  return (
    <>
      {/* Siguiente paso */}
      <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-semibold text-primary uppercase tracking-wide flex-1">Siguiente paso</span>
          <span className={cn("text-[10px] font-semibold rounded-full border px-2 py-0.5", tone(b.next_step.urgency))}>Urgencia {b.next_step.urgency}</span>
        </div>
        <p className="text-sm font-medium leading-relaxed">{b.next_step.title}</p>
        <p className="text-xs text-muted-foreground mt-1.5 italic">{b.next_step.reason}</p>
        {b.next_step.when && <p className="text-[11px] mt-2 font-medium text-foreground/80">⏱ {b.next_step.when}</p>}
      </div>

      {/* Alertas */}
      {b.alerts.length > 0 && (
        <div className="space-y-1.5">
          {b.alerts.map((a, i) => (
            <div key={i} className={cn("flex gap-2 rounded-lg border px-3 py-2 text-xs", tone(a.level))}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Mensajes */}
      <Section title="Mensajes sugeridos" defaultOpen>
        <div className="space-y-2">
          {b.messages.map((m, i) => (
            <div key={i} className="rounded-lg border border-border bg-background p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{m.tone}</div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</p>
              <div className="flex gap-1.5 mt-2 justify-end">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => copy(m.text)}><Copy className="h-3 w-3" /> Copiar</Button>
                {onUseMessage && (
                  <Button size="sm" className="h-7 text-xs" onClick={() => { onUseMessage(m.text); toast.success("Mensaje listo en el chat"); }}>
                    <Send className="h-3 w-3" /> Usar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Resumen */}
      <Section title="Resumen del lead" defaultOpen={!compact}>
        <p className="text-sm leading-relaxed">{b.summary}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className={cn("text-[10px] font-semibold rounded-full border px-2 py-0.5", tone(b.intent))}>Intención {b.intent}</span>
          <span className="text-[10px] font-semibold rounded-full border border-border px-2 py-0.5 text-muted-foreground">
            Ánimo: {({ positive: "positivo", neutral: "neutral", negative: "negativo", unknown: "sin datos" } as const)[b.sentiment]}
          </span>
        </div>
        {b.motivators.length > 0 && <List label="Le importa" items={b.motivators} />}
        {b.objections.length > 0 && <List label="Objeciones" items={b.objections} />}
      </Section>

      {/* Guion */}
      <Section title="Guion de llamada">
        <div className="space-y-2 text-sm">
          <p><span className="font-semibold">Apertura: </span>{b.call_script.opening}</p>
          {b.call_script.points.length > 0 && <List label="Puntos a tratar" items={b.call_script.points} />}
          {b.call_script.objection_handling.map((o, i) => (
            <div key={i} className="rounded-lg bg-muted/50 p-2 text-xs">
              <div className="font-semibold">“{o.objection}”</div>
              <div className="text-muted-foreground mt-0.5">{o.answer}</div>
            </div>
          ))}
          <p><span className="font-semibold">Cierre: </span>{b.call_script.close}</p>
        </div>
      </Section>

      {/* Probabilidad */}
      {!hideProbability && <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Probabilidad de cierre (IA)</div>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold">{b.close_probability.pct}%</span>
          <span className={cn("text-[10px] font-semibold rounded-full border px-2 py-0.5", tone(b.close_probability.label))}>{b.close_probability.label}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{b.close_probability.reason}</p>
      </div>}
    </>
  );
}

function Section({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => setOpen(!open)}>
        {title} <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-2">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <ul className="list-disc pl-4 text-sm space-y-0.5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}
