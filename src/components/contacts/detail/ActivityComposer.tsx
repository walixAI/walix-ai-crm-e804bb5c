import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCreateContactActivity, type ManualActivityType } from "@/lib/queries/contacts";

interface Props { contactId: string }

const TYPES: { value: ManualActivityType; label: string }[] = [
  { value: "call", label: "Llamada" },
  { value: "meeting", label: "Reunión" },
  { value: "email", label: "Email" },
  { value: "note", label: "Nota" },
  { value: "manual", label: "Otro" },
];

export function ActivityComposer({ contactId }: Props) {
  const [type, setType] = useState<ManualActivityType>("call");
  const [text, setText] = useState("");
  const create = useCreateContactActivity(contactId);

  async function save() {
    const t = text.trim();
    if (!t) return toast.error("Describe la actividad");
    try {
      await create.mutateAsync({ type, description: t });
      setText("");
      toast.success("Actividad registrada");
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card space-y-2">
      <div className="flex gap-2 items-start">
        <Select value={type} onValueChange={(v) => setType(v as ManualActivityType)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe la interacción…"
          rows={2}
          className="flex-1"
          maxLength={1000}
        />
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={create.isPending || !text.trim()}>
          {create.isPending ? "Registrando…" : "Registrar"}
        </Button>
      </div>
    </div>
  );
}