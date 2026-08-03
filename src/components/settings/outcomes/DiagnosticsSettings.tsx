import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Wand2, PauseCircle, CircleSlash, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useDealBlockers, useDealLossReasons, useUpsertBlocker, useDeleteBlocker,
  useUpsertLossReason, useDeleteLossReason, useSeedDealDiagnostics,
  useNoResponseDays, useSetNoResponseDays,
} from "@/lib/queries/dealDiagnostics";

const SILENCE_OPTIONS = [5, 7, 10, 15, 21, 30];

export function DiagnosticsSettings() {
  const { data: blockers = [] } = useDealBlockers();
  const { data: reasons = [] } = useDealLossReasons();
  const { data: silenceDays } = useNoResponseDays();
  const upsertBlocker = useUpsertBlocker();
  const delBlocker = useDeleteBlocker();
  const upsertReason = useUpsertLossReason();
  const delReason = useDeleteLossReason();
  const seed = useSeedDealDiagnostics();
  const setSilence = useSetNoResponseDays();

  const [newBlocker, setNewBlocker] = useState("");
  const [newBlockerDays, setNewBlockerDays] = useState("7");
  const [newReason, setNewReason] = useState("");

  async function addBlocker() {
    if (!newBlocker.trim()) return toast.error("Escribe el nombre del bloqueo");
    try {
      await upsertBlocker.mutateAsync({
        label: newBlocker.trim(),
        defaultResolutionDays: Number(newBlockerDays) || 7,
      });
      setNewBlocker("");
      toast.success("Bloqueo creado");
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }

  async function addReason() {
    if (!newReason.trim()) return toast.error("Escribe el motivo");
    try {
      await upsertReason.mutateAsync({ label: newReason.trim() });
      setNewReason("");
      toast.success("Motivo creado");
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Diagnóstico de por qué no avanzan</div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Los <strong>bloqueos</strong> registran qué está esperando un lead que sigue vivo.
              Los <strong>motivos de pérdida</strong> registran por qué se cayó. El cruce de ambos
              revela la causa real detrás de los leads que se quedan callados.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={seed.isPending}
            onClick={async () => {
              try {
                await seed.mutateAsync();
                toast.success("Catálogos recomendados agregados");
              } catch (e: any) { toast.error(e?.message ?? "Error"); }
            }}
          >
            <Wand2 className="h-4 w-4" /> Agregar catálogos recomendados
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-border">
          <div className="min-w-[220px]">
            <Label className="text-xs flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Días sin respuesta para marcar "Sin respuesta"
            </Label>
            <Select
              value={String(silenceDays ?? 10)}
              onValueChange={async (v) => {
                try {
                  await setSilence.mutateAsync(Number(v));
                  toast.success("Umbral actualizado");
                } catch (e: any) { toast.error(e?.message ?? "Error"); }
              }}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SILENCE_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{d} días</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground max-w-md pb-2">
            La oportunidad no se cierra sola: sólo se marca y conserva el último bloqueo declarado
            para que el vendedor decida reactivarla o darla por perdida.
          </p>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <PauseCircle className="h-4 w-4 text-warning" /> Bloqueos (el lead sigue vivo)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Nuevo bloqueo</Label>
            <Input
              className="h-9" value={newBlocker} maxLength={80}
              onChange={(e) => setNewBlocker(e.target.value)}
              placeholder="Ej. Esperando visto bueno de compras"
            />
          </div>
          <div>
            <Label className="text-xs">Días esperados</Label>
            <Input
              type="number" min={1} max={365} className="h-9"
              value={newBlockerDays} onChange={(e) => setNewBlockerDays(e.target.value)}
            />
          </div>
          <Button size="icon" className="h-9 w-9" onClick={addBlocker} disabled={upsertBlocker.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {blockers.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aún no hay bloqueos configurados.</p>
        ) : blockers.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-2 border border-border rounded-lg px-3 py-2">
            <span className="text-sm font-medium flex-1 min-w-[180px]">{b.label}</span>
            {b.description && (
              <span className="text-[11px] text-muted-foreground flex-1 min-w-[160px]">{b.description}</span>
            )}
            <div className="flex items-center gap-1">
              <Input
                type="number" min={1} max={365}
                className="h-8 w-[70px] text-xs"
                defaultValue={b.defaultResolutionDays}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v && v !== b.defaultResolutionDays) {
                    upsertBlocker.mutate({ ...b, defaultResolutionDays: v });
                  }
                }}
              />
              <span className="text-[11px] text-muted-foreground">días</span>
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={b.isActive} onCheckedChange={(v) => upsertBlocker.mutate({ ...b, isActive: v })} />
              <span className="text-[11px] text-muted-foreground">Activo</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => delBlocker.mutate(b.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <CircleSlash className="h-4 w-4 text-danger" /> Motivos de pérdida
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Nuevo motivo</Label>
            <Input
              className="h-9" value={newReason} maxLength={80}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Ej. Prefirió reparar en lugar de comprar"
            />
          </div>
          <Button size="icon" className="h-9 w-9" onClick={addReason} disabled={upsertReason.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {reasons.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aún no hay motivos configurados.</p>
        ) : reasons.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 border border-border rounded-lg px-3 py-2">
            <span className="text-sm font-medium flex-1 min-w-[180px]">{r.label}</span>
            {r.description && (
              <span className="text-[11px] text-muted-foreground flex-1 min-w-[160px]">{r.description}</span>
            )}
            <div className="flex items-center gap-1">
              <Switch checked={r.isActive} onCheckedChange={(v) => upsertReason.mutate({ ...r, isActive: v })} />
              <span className="text-[11px] text-muted-foreground">Activo</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => delReason.mutate(r.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}