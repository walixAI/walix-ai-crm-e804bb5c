import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useInterpretRulePrompt, useSegmentSend, type CampaignConditions } from "@/lib/queries/whatsappCampaigns";

interface Props {
  mode: "filters" | "prompt";
  onModeChange: (m: "filters" | "prompt") => void;
  conditions: CampaignConditions;
  onConditionsChange: (c: CampaignConditions) => void;
  prompt: string;
  onPromptChange: (p: string) => void;
  unresolved: string[];
  onUnresolvedChange: (u: string[]) => void;
  onObjectiveSuggested?: (o: string) => void;
}

const listField = (
  label: string,
  value: string[] | undefined,
  onChange: (v: string[]) => void,
  placeholder: string,
) => (
  <div className="space-y-1.5" key={label}>
    <Label className="text-xs">{label}</Label>
    <Input
      value={(value ?? []).join(", ")}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
      }
    />
  </div>
);

export function CampaignRuleEditor({
  mode, onModeChange, conditions, onConditionsChange, prompt, onPromptChange,
  unresolved, onUnresolvedChange, onObjectiveSuggested,
}: Props) {
  const interpret = useInterpretRulePrompt();
  const segment = useSegmentSend();
  const [summary, setSummary] = useState("");
  const [preview, setPreview] = useState<{ total: number; sample: any[] } | null>(null);

  const set = (patch: Partial<CampaignConditions>) => onConditionsChange({ ...conditions, ...patch });

  const runInterpret = async () => {
    if (!prompt.trim()) return;
    try {
      const res = await interpret.mutateAsync(prompt.trim());
      onConditionsChange(res.conditions);
      onUnresolvedChange(res.unresolved ?? []);
      setSummary(res.summary ?? "");
      setPreview(res.preview);
      if (res.objective) onObjectiveSuggested?.(res.objective);
      toast.success("Regla interpretada");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo interpretar la regla");
    }
  };

  const runPreview = async () => {
    try {
      const res = await segment.mutateAsync({ conditions, preview: true });
      setPreview({ total: res.total, sample: res.sample ?? [] });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo calcular la vista previa");
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => onModeChange(v as "filters" | "prompt")}>
        <TabsList>
          <TabsTrigger value="filters">Filtros</TabsTrigger>
          <TabsTrigger value="prompt">Describir con IA</TabsTrigger>
        </TabsList>

        <TabsContent value="filters" className="pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {listField("Origen del lead", conditions.source_kinds, (v) => set({ source_kinds: v }), "meta_ads, web, api")}
            {listField("Canal (GA4)", conditions.ga_channels, (v) => set({ ga_channels: v }), "Paid Social, Organic Search")}
            {listField("utm_source", conditions.utm_sources, (v) => set({ utm_sources: v }), "facebook, google")}
            {listField("utm_campaign", conditions.utm_campaigns, (v) => set({ utm_campaigns: v }), "verano_2026")}
            {listField("Ciudad", conditions.cities, (v) => set({ cities: v }), "Ciudad de México")}
            {listField("Estado", conditions.regions, (v) => set({ regions: v }), "Jalisco")}
            {listField("Producto / programa", conditions.products, (v) => set({ products: v }), "Licenciatura, Maestría")}
            {listField("Etiquetas", conditions.tags, (v) => set({ tags: v }), "caliente, referido")}
            {listField("Ciclo de vida", conditions.lifecycle, (v) => set({ lifecycle: v }), "prospecto, cliente")}
            <div className="space-y-1.5">
              <Label className="text-xs">Sin respuesta (días)</Label>
              <Input
                type="number" min={0}
                value={conditions.no_reply_days ?? ""}
                onChange={(e) => set({ no_reply_days: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Creados en los últimos (días)</Label>
              <Input
                type="number" min={0}
                value={conditions.created_within_days ?? ""}
                onChange={(e) => set({ created_within_days: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="prompt" className="pt-4 space-y-3">
          <Textarea
            rows={4}
            placeholder="Ej. Todos los leads nuevos de Meta Ads de los últimos 7 días interesados en Maestría que aún no responden."
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
          />
          <Button type="button" onClick={runInterpret} disabled={interpret.isPending || !prompt.trim()}>
            {interpret.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Interpretar regla
          </Button>
          {summary && (
            <Card>
              <CardContent className="pt-4 space-y-2 text-sm">
                <p className="font-medium">Esto entendí</p>
                <p className="text-muted-foreground">{summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(conditions).map(([k, v]) =>
                    v && (Array.isArray(v) ? v.length : true) ? (
                      <Badge key={k} variant="secondary">{k}: {Array.isArray(v) ? v.join(", ") : String(v)}</Badge>
                    ) : null,
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {unresolved.length > 0 && (
            <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
              <div>
                <p className="font-medium">No pude representar esto en la regla:</p>
                <ul className="list-disc pl-4 text-muted-foreground">
                  {unresolved.map((u, i) => <li key={i}>{u}</li>)}
                </ul>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={runPreview} disabled={segment.isPending}>
          {segment.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
          Vista previa
        </Button>
        {preview && (
          <p className="text-sm text-muted-foreground">
            {preview.total} contacto(s) cumplen
            {preview.sample.length > 0 && `: ${preview.sample.slice(0, 3).map((s) => s.name).join(", ")}…`}
          </p>
        )}
      </div>
    </div>
  );
}
