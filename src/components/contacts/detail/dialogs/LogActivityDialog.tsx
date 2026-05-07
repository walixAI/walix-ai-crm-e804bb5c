import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useCreateContactActivity,
  useUpdateContactActivity,
  type ManualActivityType,
} from "@/lib/queries/contacts";
import { aiMemory } from "@/services/aiMemory";

export type LogKind = "call" | "meeting" | "email" | "note";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contactId: string;
  kind: LogKind;
  /** Pre-filled description for new entries. */
  defaultDescription?: string;
  // For edit:
  initial?: {
    id: string;
    description: string;
    occurredAt: string;
    metadata: Record<string, any>;
  } | null;
}

const TITLES: Record<LogKind, string> = {
  call: "Registrar llamada",
  meeting: "Registrar reunión",
  email: "Registrar email",
  note: "Nueva nota",
};

const CALL_RESULTS = ["Conectó", "No contestó", "Buzón de voz", "Reagendar"];

export function LogActivityDialog({ open, onOpenChange, contactId, kind, initial, defaultDescription }: Props) {
  const isEdit = !!initial;
  const create = useCreateContactActivity(contactId);
  const update = useUpdateContactActivity(contactId);

  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState(() => format(new Date(), "HH:mm"));
  const [duration, setDuration] = useState("");
  const [result, setResult] = useState<string>("Conectó");
  const [subject, setSubject] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setDescription(initial.description ?? "");
      const d = new Date(initial.occurredAt);
      setDate(d);
      setTime(format(d, "HH:mm"));
      setDuration(initial.metadata?.duration ?? "");
      setResult(initial.metadata?.result ?? "Conectó");
      setSubject(initial.metadata?.subject ?? "");
      setLocation(initial.metadata?.location ?? "");
    } else {
      setDescription(defaultDescription ?? "");
      const now = new Date();
      setDate(now); setTime(format(now, "HH:mm"));
      setDuration(""); setResult("Conectó"); setSubject(""); setLocation("");
    }
  }, [open, initial, defaultDescription]);

  async function save() {
    if (!description.trim() && kind !== "email") return toast.error("Describe la actividad");
    const [hh, mm] = time.split(":").map(Number);
    const occurred = new Date(date);
    occurred.setHours(hh ?? 0, mm ?? 0, 0, 0);
    const metadata: Record<string, any> = {};
    if (kind === "call") { metadata.duration = duration || null; metadata.result = result; }
    if (kind === "meeting") { metadata.location = location || null; }
    if (kind === "email") { metadata.subject = subject || null; }

    try {
      if (isEdit && initial) {
        await update.mutateAsync({
          id: initial.id,
          description: description.trim(),
          occurredAt: occurred.toISOString(),
          metadata,
        });
        toast.success("Actividad actualizada");
      } else {
        await create.mutateAsync({
          type: kind as ManualActivityType,
          description: description.trim() || subject.trim() || "(sin descripción)",
          occurredAt: occurred.toISOString(),
          metadata,
        });
        const eventType =
          kind === "note" ? "note_added" :
          kind === "call" ? "call_logged" :
          kind === "meeting" ? "meeting_logged" :
          kind === "email" ? "email_logged" : "activity_logged";
        aiMemory.logEvent("contact", contactId, eventType, { kind, ...metadata }).catch(() => {});
        toast.success("Actividad registrada");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{TITLES[kind]}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {kind !== "note" && (
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <div>
                <Label className="text-xs">Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9")}>
                      <CalendarIcon className="h-4 w-4" />
                      {format(date, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">Hora</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9" />
              </div>
            </div>
          )}

          {kind === "call" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Duración</Label>
                <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="5 min" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Resultado</Label>
                <Select value={result} onValueChange={setResult}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CALL_RESULTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {kind === "meeting" && (
            <div>
              <Label className="text-xs">Lugar / Link</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Oficina o https://meet…" className="h-9" />
            </div>
          )}

          {kind === "email" && (
            <div>
              <Label className="text-xs">Asunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Propuesta enviada" className="h-9" />
            </div>
          )}

          <div>
            <Label className="text-xs">Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="¿Qué pasó?"
              maxLength={2000}
            />
          </div>
          {isEdit && (
            <p className="text-[11px] text-muted-foreground">
              Registrada el {format(new Date(initial!.occurredAt), "PPP HH:mm")}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={create.isPending || update.isPending}>
            {isEdit ? "Guardar cambios" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}