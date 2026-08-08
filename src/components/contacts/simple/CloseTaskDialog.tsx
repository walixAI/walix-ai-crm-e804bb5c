import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MessageCircle, Phone, CheckCircle2, Sparkles, CalendarClock, AlertTriangle, Send } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useToggleContactTask, useCreateContactActivity,
} from "@/lib/queries/contacts";
import { useRescheduleTask } from "@/lib/queries/tasks";
import {
  suggestedChannel, buildDraftMessage, messageMatchesTask, suggestReschedule,
} from "@/lib/tasks/closure";
import { toLocalInput, fromLocalInput } from "@/lib/format/localDatetime";
import { blockWhatsappAction, useWhatsappChatEnabled, WHATSAPP_DISABLED_REASON } from "@/lib/whatsapp/featureFlags";

type Method = "whatsapp" | "call" | "other";
type CallResult = "answered" | "no_answer" | "voicemail";
type Mode = "resolve" | "reschedule";

interface CloseTask {
  id: string;
  title: string;
  taskKind?: string | null;
  dueAt?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contactId: string;
  task: CloseTask | null;
  /** Datos opcionales del contacto para redactar el borrador. */
  contact?: { firstName?: string | null; name?: string | null } | null;
  /** Deal ligado (opcional) para contextualizar borrador y reagenda. */
  deal?: { id?: string; name?: string | null; amount?: number | null; probability?: number | null; stageName?: string | null; expectedCloseDate?: string | null } | null;
}

export function CloseTaskDialog({ open, onOpenChange, contactId, task, contact, deal }: Props) {
  const WHATSAPP_CHAT_ENABLED = useWhatsappChatEnabled();
  const suggested = suggestedChannel(task?.taskKind);
  const [method, setMethod] = useState<Method>(suggested);
  const [mode, setMode] = useState<Mode>("resolve");
  const [note, setNote] = useState("");
  const [callResult, setCallResult] = useState<CallResult>("answered");
  const [message, setMessage] = useState("");
  const [ackNoMatch, setAckNoMatch] = useState(false);
  const [sending, setSending] = useState(false);
  const [reschedReason, setReschedReason] = useState<string>("");
  const [reschedWhen, setReschedWhen] = useState<string>("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const toggle = useToggleContactTask(contactId);
  const createActivity = useCreateContactActivity(contactId);
  const reschedule = useRescheduleTask();

  const suggestion = useMemo(
    () => task ? suggestReschedule({ task_kind: task.taskKind, dueAt: task.dueAt }, deal ?? null) : null,
    [task, deal],
  );

  // Sync suggested channel + draft when task changes / dialog opens
  useMemo(() => {
    if (!open || !task) return;
    const ch = suggestedChannel(task.taskKind);
    setMethod(ch);
    setMode("resolve");
    setNote("");
    setAckNoMatch(false);
    setCallResult("answered");
    setReschedReason(suggestion?.reason ?? "");
    setReschedWhen(suggestion ? toLocalInput(suggestion.date) : "");
    setMessage(buildDraftMessage(
      { title: task.title, task_kind: task.taskKind },
      contact ?? null,
      deal ?? null,
    ));
  }, [open, task?.id]); // eslint-disable-line

  function reset() {
    setMethod("call"); setNote(""); setCallResult("answered"); setAckNoMatch(false); setMode("resolve");
  }

  async function sendWhatsappAndClose() {
    if (!WHATSAPP_CHAT_ENABLED) return;
    if (!task) return;

    const matches = messageMatchesTask(
      message,
      { title: task.title, task_kind: task.taskKind },
      { contactName: contact?.name ?? null, dealName: deal?.name ?? null },
    );
    if (!matches && !ackNoMatch) {
      toast.warning("El mensaje no parece relacionado al pendiente. Confirma para cerrar de todos modos.");
      setAckNoMatch(true);
      return;
    }
    try {
      setSending(true);
      // 1. Find or create a conversation for this contact
      const conv = await ensureConversation(contactId, user?.id ?? null);
      // 2. Send message via edge function
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: { conversationId: conv.id, body: message, internal: false },
      });
      if (error) throw new Error(errMsg(error, "No se pudo enviar el mensaje"));
      // 3. Close the task with evidence
      await toggle.mutateAsync({
        id: task.id,
        completed: true,
        via: "whatsapp",
        note: `WhatsApp enviado — ${message.slice(0, 160)}`,
      });
      toast.success(data?.simulated ? "Mensaje simulado enviado y tarea cerrada" : "Mensaje enviado y tarea cerrada");
      onOpenChange(false); reset();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo enviar");
    } finally {
      setSending(false);
    }
  }

  async function submitCall() {
    if (!task) return;
    const resultLabel =
      callResult === "answered" ? "Contestó" :
      callResult === "no_answer" ? "No contestó" : "Buzón de voz";
    const needsReschedule = callResult !== "answered";
    if (callResult === "answered" && !note.trim()) {
      toast.warning("Escribe una nota corta con el próximo paso");
      return;
    }
    if (needsReschedule && !reschedWhen) {
      toast.warning("Selecciona cuándo reintentar");
      return;
    }
    try {
      const noteText = note.trim() || (needsReschedule ? "Sin contacto — se reagenda" : "");
      await createActivity.mutateAsync({
        type: "call",
        description: `${resultLabel} — ${task.title}\n${noteText}`,
        metadata: { call_result: callResult, task_id: task.id, rescheduled: needsReschedule },
      });
      if (needsReschedule) {
        await reschedule.mutateAsync({
          id: task.id,
          dueAt: fromLocalInput(reschedWhen),
          reason: reschedReason || `${resultLabel} — reintentar`,
        });
        toast.success(`Llamada registrada · Reagendada ${new Date(fromLocalInput(reschedWhen)).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`);
      } else {
        await toggle.mutateAsync({
          id: task.id, completed: true, via: "call",
          note: `${resultLabel} — ${note.slice(0, 160)}`,
        });
        toast.success("Llamada registrada y tarea cerrada");
      }
      onOpenChange(false); reset();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cerrar");
    }
  }

  async function submitOther() {
    if (!task) return;
    if (!note.trim()) {
      toast.warning("Describe brevemente qué pasó");
      return;
    }
    try {
      await createActivity.mutateAsync({
        type: "note",
        description: `${task.title}\n${note}`,
        metadata: { task_id: task.id },
      });
      await toggle.mutateAsync({
        id: task.id, completed: true, via: "other", note: note.slice(0, 160),
      });
      toast.success("Tarea marcada como hecha");
      onOpenChange(false); reset();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cerrar");
    }
  }

  async function submitReschedule() {
    if (!task) return;
    if (!reschedWhen) { toast.warning("Selecciona fecha y hora"); return; }
    try {
      await reschedule.mutateAsync({
        id: task.id,
        dueAt: fromLocalInput(reschedWhen),
        reason: reschedReason || suggestion?.reason || "Reagendado",
      });
      toast.success(`Reagendada · ${new Date(fromLocalInput(reschedWhen)).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`);
      onOpenChange(false); reset();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo reagendar");
    }
  }

  const isWA = method === "whatsapp";

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {mode === "resolve" ? "¿Cómo la resolviste?" : "Reagendar pendiente"}
          </DialogTitle>
        </DialogHeader>
        {task && <p className="text-sm text-muted-foreground -mt-2">{task.title}</p>}

        {/* Tabs Resolve / Reschedule */}
        <div className="flex gap-2 pt-2">
          <Button variant={mode === "resolve" ? "default" : "outline"} size="sm" onClick={() => setMode("resolve")}>
            <CheckCircle2 className="h-4 w-4" /> Resolver
          </Button>
          <Button variant={mode === "reschedule" ? "default" : "outline"} size="sm" onClick={() => setMode("reschedule")}>
            <CalendarClock className="h-4 w-4" /> Reagendar
          </Button>
        </div>

        {mode === "resolve" && (
          <>
            <RadioGroup
              value={method}
              onValueChange={(v) => { setMethod(v as Method); setAckNoMatch(false); }}
              className="grid grid-cols-3 gap-3 pt-2"
            >
              <MethodTile value="whatsapp" label="WhatsApp" icon={<MessageCircle className="h-6 w-6" />} active={method==="whatsapp"} recommended={suggested==="whatsapp"} />
              <MethodTile value="call" label="Llamada" icon={<Phone className="h-6 w-6" />} active={method==="call"} recommended={suggested==="call"} />
              <MethodTile value="other" label="Otro" icon={<CheckCircle2 className="h-6 w-6" />} active={method==="other"} recommended={suggested==="other"} />
            </RadioGroup>

            {isWA && (
              <div className="space-y-2 pt-2">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Mensaje sugerido
                </Label>
                <Textarea
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); setAckNoMatch(false); }}
                  rows={5}
                  className="text-base"
                />
                {ackNoMatch && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Este mensaje no menciona el pendiente. Puedes editarlo o presionar de nuevo para enviar y cerrar de todos modos.</span>
                  </div>
                )}
              </div>
            )}

            {method === "call" && (
              <div className="space-y-3 pt-2">
                <div className="space-y-2">
                  <Label>Resultado</Label>
                  <RadioGroup value={callResult} onValueChange={(v) => setCallResult(v as CallResult)} className="grid grid-cols-3 gap-2">
                    {[
                      { v: "answered", l: "Contestó" },
                      { v: "no_answer", l: "No contestó" },
                      { v: "voicemail", l: "Buzón" },
                    ].map((o) => (
                      <label key={o.v}
                        className={`text-sm border rounded-lg px-3 py-2 text-center cursor-pointer ${callResult===o.v ? "border-primary bg-primary/5 font-semibold" : "border-border"}`}>
                        <RadioGroupItem value={o.v} className="sr-only" />
                        {o.l}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
                {callResult === "answered" ? (
                  <div className="space-y-2">
                    <Label>Nota corta con el próximo paso <span className="text-destructive">*</span></Label>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Ej. Va a pagar el viernes / pide llamar la próxima semana"
                      rows={2} className="text-base" />
                  </div>
                ) : (
                  <RescheduleInline
                    when={reschedWhen}
                    onWhen={setReschedWhen}
                    reason={reschedReason}
                    onReason={setReschedReason}
                    suggestion={suggestion}
                    headline={callResult === "no_answer" ? "No contestó — te sugiero reintentar" : "Buzón de voz — te sugiero reintentar"}
                  />
                )}
              </div>
            )}

            {method === "other" && (
              <div className="space-y-2 pt-2">
                <Label>Describe qué pasó <span className="text-destructive">*</span></Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Ej. Visité al cliente, dejé cotización impresa"
                  rows={3} className="text-base" />
              </div>
            )}
          </>
        )}

        {mode === "reschedule" && (
          <div className="space-y-3 pt-2">
            <RescheduleInline
              when={reschedWhen}
              onWhen={setReschedWhen}
              reason={reschedReason}
              onReason={setReschedReason}
              suggestion={suggestion}
              headline="Sugerencia inteligente"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => { onOpenChange(false); }}>Cancelar</Button>
          {mode === "resolve" && isWA && (
            <Button size="lg" onClick={() => { void handleWhatsappClick(); }}
              title={WHATSAPP_CHAT_ENABLED ? undefined : WHATSAPP_DISABLED_REASON}
              disabled={sending || !message.trim()}>
              <Send className="mr-1 h-4 w-4" />
              {ackNoMatch ? "Enviar y cerrar" : "Enviar WhatsApp"}
            </Button>
          )}
          {mode === "resolve" && method === "call" && (
            <Button size="lg" onClick={submitCall} disabled={toggle.isPending || createActivity.isPending || reschedule.isPending}>
              {callResult === "answered" ? "Registrar llamada" : (
                <><CalendarClock className="mr-1 h-4 w-4" /> Registrar y reagendar</>
              )}
            </Button>
          )}
          {mode === "resolve" && method === "other" && (
            <Button size="lg" onClick={submitOther} disabled={toggle.isPending || createActivity.isPending}>
              Marcar como hecha
            </Button>
          )}
          {mode === "reschedule" && (
            <Button size="lg" onClick={submitReschedule} disabled={reschedule.isPending}>
              <CalendarClock className="mr-1 h-4 w-4" /> Reagendar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MethodTile({ value, label, icon, active, recommended }: { value: string; label: string; icon: React.ReactNode; active: boolean; recommended?: boolean }) {
  return (
    <label className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 cursor-pointer transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
      <RadioGroupItem value={value} className="sr-only" />
      {recommended && (
        <span className="absolute -top-2 right-2 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
          Sugerido
        </span>
      )}
      <div className={active ? "text-primary" : "text-muted-foreground"}>{icon}</div>
      <span className="text-sm font-semibold">{label}</span>
    </label>
  );
}

// ─────────────────────────── helpers ───────────────────────────
function errMsg(err: any, fallback: string): string {
  const ctx = err?.context?.body;
  if (ctx) { try { return JSON.parse(ctx).error ?? fallback; } catch { /* noop */ } }
  return err?.message ?? fallback;
}

async function ensureConversation(contactId: string, userId: string | null) {
  // Try existing open conversation first
  const { data: existing } = await supabase
    .from("conversations")
    .select("id, tenant_id")
    .eq("contact_id", contactId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing;

  // Fallback: create one using tenant_id from the contact row
  const { data: c } = await supabase.from("contacts").select("tenant_id, phone").eq("id", contactId).maybeSingle();
  if (!c?.tenant_id) throw new Error("No se encontró el contacto");
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      tenant_id: c.tenant_id,
      contact_id: contactId,
      status: "open",
      assignee_id: userId,
    } as any)
    .select("id, tenant_id")
    .single();
  if (error) throw error;
  return created;
}

// ─────────────── Reschedule inline block ───────────────
function RescheduleInline({
  when, onWhen, reason, onReason, suggestion, headline,
}: {
  when: string;
  onWhen: (v: string) => void;
  reason: string;
  onReason: (v: string) => void;
  suggestion: { date: Date; reason: string } | null;
  headline: string;
}) {
  const quicks = [
    { label: "En 2 h", mins: 120 },
    { label: "Mañana 9 am", tomorrowHour: 9 },
    { label: "En 3 días", days: 3, hour: 10 },
  ];
  return (
    <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <CalendarClock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-primary">{headline}</div>
          {suggestion && (
            <div className="text-xs text-muted-foreground mt-0.5">{suggestion.reason}</div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {quicks.map((q) => (
          <Button key={q.label} type="button" variant="outline" size="sm"
            onClick={() => {
              const d = new Date();
              if (q.mins) d.setMinutes(d.getMinutes() + q.mins);
              else if (q.tomorrowHour != null) { d.setDate(d.getDate() + 1); d.setHours(q.tomorrowHour, 0, 0, 0); }
              else if (q.days) { d.setDate(d.getDate() + q.days); d.setHours(q.hour ?? 10, 0, 0, 0); }
              onWhen(toLocalInput(d));
            }}>
            {q.label}
          </Button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Cuándo reintentar</Label>
        <Input type="datetime-local" value={when} onChange={(e) => onWhen(e.target.value)} className="h-11 text-base" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Motivo (opcional)</Label>
        <Textarea rows={2} value={reason} onChange={(e) => onReason(e.target.value)}
          placeholder="Ej. Cliente pidió llamar el viernes" className="text-base" />
      </div>
    </div>
  );
}