import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useActivityOutcomes } from "@/lib/queries/activityOutcomes";
import {
  useOutcomeTypifications, useUpsertTypification, useDeleteTypification,
  type TypificationSentiment,
} from "@/lib/queries/typifications";

const SENTIMENTS: { value: TypificationSentiment; label: string }[] = [
  { value: "positive", label: "Positiva" },
  { value: "neutral", label: "Neutra" },
  { value: "negative", label: "Negativa" },
];

const DOT: Record<TypificationSentiment, string> = {
  positive: "bg-success",
  neutral: "bg-muted-foreground",
  negative: "bg-destructive",
};

/** Catálogo de tipificaciones por resultado (qué dijo el lead en cada seguimiento). */
export function TypificationsSettings({ pipelineId }: { pipelineId: string | null }) {
  const { data: outcomes = [] } = useActivityOutcomes(pipelineId);
  const { data: typs = [] } = useOutcomeTypifications();
  const upsert = useUpsertTypification();
  const del = useDeleteTypification();

  const [outcomeId, setOutcomeId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [sentiment, setSentiment] = useState<TypificationSentiment>("neutral");

  // Resultados únicos por etiqueta (se repiten por etapa): la tipificación se crea para cada uno.
  const uniqueOutcomes = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const o of outcomes.filter((x) => x.isActive)) {
      const k = o.label.trim();
      m.set(k, [...(m.get(k) ?? []), o.id]);
    }
    return [...m.keys()];
  }, [outcomes]);

  const byOutcomeLabel = useMemo(() => {
    const m = new Map<string, typeof typs>();
    const labelOf = new Map(outcomes.map((o) => [o.id, o.label.trim()]));
    for (const t of typs) {
      const k = t.outcomeId ? labelOf.get(t.outcomeId) ?? "Otros" : "Todas los resultados";
      if (!m.has(k)) m.set(k, []);
      const list = m.get(k)!;
      if (!list.some((x) => x.id === t.id)) list.push(t);
    }
    return m;
  }, [typs, outcomes]);

  async function add() {
    if (!label.trim()) return toast.error("Escribe la tipificación");
    const ids = outcomeId
      ? outcomes.filter((o) => o.label.trim() === outcomeId).map((o) => o.id)
      : [null];
    try {
      for (const id of ids) {
        await upsert.mutateAsync({
          outcomeId: id,
          label: label.trim(),
          sentiment,
          position: 99,
          isActive: true,
        });
      }
      setLabel("");
      toast.success("Tipificación agregada");
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  return (
    <Card className="p-4 space-y-4">
      <div>
        <div className="text-sm font-semibold">Tipificaciones por resultado</div>
        <p className="text-xs text-muted-foreground">
          Es lo que dijo el lead en el seguimiento (ej. «No puede pagar», «Pide información»).
          El asesor la elige con un clic al registrar el resultado y alimenta el Análisis del embudo en Reportes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <div className="md:col-span-2">
          <Label className="text-xs">Tipificación</Label>
          <Input
            className="h-9"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            placeholder="Ej. No puede pagar"
          />
        </div>
        <div>
          <Label className="text-xs">Resultado</Label>
          <Select value={outcomeId || "all"} onValueChange={(v) => setOutcomeId(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los resultados</SelectItem>
              {uniqueOutcomes.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Sentimiento</Label>
          <div className="flex gap-2">
            <Select value={sentiment} onValueChange={(v) => setSentiment(v as TypificationSentiment)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SENTIMENTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="icon" className="h-9 w-9 shrink-0" onClick={add} disabled={upsert.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {[...byOutcomeLabel.entries()].map(([group, list]) => (
        <div key={group} className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">{group}</div>
          {list.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <span className={cn("h-2 w-2 rounded-full", DOT[t.sentiment])} />
              <span className="flex-1 text-sm">{t.label}</span>
              <Select
                value={t.sentiment}
                onValueChange={(v) => upsert.mutate({ ...t, sentiment: v as TypificationSentiment })}
              >
                <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SENTIMENTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Switch
                  checked={t.isActive}
                  onCheckedChange={(v) => upsert.mutate({ ...t, isActive: v })}
                />
                <span className="text-[11px] text-muted-foreground">Activa</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => del.mutate(t.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ))}
    </Card>
  );
}
