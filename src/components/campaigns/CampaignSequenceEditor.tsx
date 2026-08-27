import { Plus, Trash2, MessageSquare, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useWaTemplates, type WaCampaignStep } from "@/lib/queries/whatsappCampaigns";

export type StepDraft = Partial<WaCampaignStep>;

interface Props {
  steps: StepDraft[];
  onChange: (steps: StepDraft[]) => void;
}

export function CampaignSequenceEditor({ steps, onChange }: Props) {
  const { data: templates = [] } = useWaTemplates();
  const approved = templates.filter((t) => (t.status ?? "").toLowerCase() === "approved");

  const update = (i: number, patch: StepDraft) => {
    const next = [...steps];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const add = () =>
    onChange([...steps, { kind: steps.length === 0 ? "template" : "text", wait_hours: steps.length === 0 ? 0 : 24, body_text: "" }]);

  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <Card key={i}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Paso {i + 1}</Badge>
                {i === 0 && <span className="text-xs text-muted-foreground">Abre la conversación</span>}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => onChange(steps.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Esperar antes de enviar (horas)</Label>
                <Input
                  type="number" min={0}
                  value={s.wait_hours ?? (i === 0 ? 0 : 24)}
                  onChange={(e) => update(i, { wait_hours: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de mensaje</Label>
                <Select value={s.kind ?? "text"} onValueChange={(v) => update(i, { kind: v as "text" | "template" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="template">
                      <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Plantilla aprobada</span>
                    </SelectItem>
                    <SelectItem value="text">
                      <span className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Texto libre (dentro de 24 h)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {s.kind === "template" ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Plantilla de Meta</Label>
                <Select value={s.template_id ?? ""} onValueChange={(v) => update(i, { template_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Elige una plantilla aprobada" /></SelectTrigger>
                  <SelectContent>
                    {approved.length === 0 && <SelectItem value="none" disabled>Sin plantillas sincronizadas</SelectItem>}
                    {approved.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name} ({t.language})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="mt-2"
                  placeholder="Variables separadas por coma. Ej. {{nombre}}, {{empresa}}"
                  value={(s.template_variables ?? []).join(", ")}
                  onChange={(e) =>
                    update(i, { template_variables: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })
                  }
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Mensaje</Label>
                <Textarea
                  rows={3}
                  placeholder="Hola {{nombre}}, ¿pudiste revisar la información?"
                  value={s.body_text ?? ""}
                  onChange={(e) => update(i, { body_text: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Variables disponibles: {"{{nombre}}"}, {"{{nombre_completo}}"}, {"{{empresa}}"}, {"{{compania}}"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={add}>
        <Plus className="h-4 w-4 mr-2" /> Agregar paso
      </Button>
    </div>
  );
}
