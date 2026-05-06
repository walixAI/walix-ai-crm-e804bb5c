import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Check, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  useContactStages,
  useUpsertStage,
  useDeleteStage,
  useReorderStages,
  type ContactStage,
} from "@/lib/queries/contactStages";
import { ConfirmDialog } from "@/components/walix/ConfirmDialog";

export function StagesEditor() {
  const { data: stages = [], isLoading } = useContactStages();
  const upsert = useUpsertStage();
  const remove = useDeleteStage();
  const reorder = useReorderStages();
  const [editing, setEditing] = useState<ContactStage | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function move(idx: number, dir: -1 | 1) {
    const next = [...stages];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    await reorder.mutateAsync(next.map((s, i) => ({ id: s.id, position: i })));
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Etapas del contacto</h3>
          <p className="text-xs text-muted-foreground">Personaliza las etapas que verán todos los vendedores.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nueva etapa
        </Button>
      </div>
      <div className="divide-y divide-border">
        {isLoading && <div className="p-4 text-sm text-muted-foreground">Cargando…</div>}
        {creating && (
          <StageRow
            stage={null}
            onCancel={() => setCreating(false)}
            onSave={async (patch) => {
              await upsert.mutateAsync({ ...patch, position: stages.length });
              toast.success("Etapa creada");
              setCreating(false);
            }}
          />
        )}
        {stages.map((s, i) => (
          editing?.id === s.id ? (
            <StageRow
              key={s.id}
              stage={s}
              onCancel={() => setEditing(null)}
              onSave={async (patch) => {
                await upsert.mutateAsync({ id: s.id, position: s.position, ...patch });
                toast.success("Etapa actualizada");
                setEditing(null);
              }}
            />
          ) : (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
              <span className="text-sm font-medium flex-1">{s.name}</span>
              <div className="flex items-center gap-1 text-[10px]">
                {s.isDefault && <span className="px-1.5 py-0.5 rounded bg-info/10 text-info">Default</span>}
                {s.isWon && <span className="px-1.5 py-0.5 rounded bg-success/10 text-success">Ganada</span>}
                {s.isLost && <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">Perdida</span>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === stages.length - 1}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setEditing(s)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setDeleteId(s.id)} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )
        ))}
        {!isLoading && stages.length === 0 && !creating && (
          <div className="p-6 text-center text-sm text-muted-foreground">Aún no hay etapas. Crea la primera.</div>
        )}
      </div>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="Eliminar etapa"
        description="¿Seguro que deseas eliminar esta etapa? Los contactos asignados a ella seguirán existiendo, pero quedarán sin etapa."
        confirmText="Eliminar"
        destructive
        onConfirm={async () => {
          if (!deleteId) return;
          await remove.mutateAsync(deleteId);
          toast.success("Etapa eliminada");
          setDeleteId(null);
        }}
      />
    </div>
  );
}

function StageRow({
  stage, onSave, onCancel,
}: {
  stage: ContactStage | null;
  onSave: (patch: { name: string; color: string; isDefault: boolean; isWon: boolean; isLost: boolean }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(stage?.name ?? "");
  const [color, setColor] = useState(stage?.color ?? "hsl(220 13% 65%)");
  const [isDefault, setIsDefault] = useState(stage?.isDefault ?? false);
  const [isWon, setIsWon] = useState(stage?.isWon ?? false);
  const [isLost, setIsLost] = useState(stage?.isLost ?? false);

  return (
    <div className="px-4 py-3 bg-muted/30 space-y-2">
      <div className="flex items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="flex-1" autoFocus />
        <input
          type="color"
          value={hslToHex(color)}
          onChange={(e) => setColor(hexToHsl(e.target.value))}
          className="h-9 w-12 rounded border border-input bg-background cursor-pointer"
          title="Color"
        />
      </div>
      <div className="flex items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5 cursor-pointer"><Switch checked={isDefault} onCheckedChange={setIsDefault} /> Default</label>
        <label className="flex items-center gap-1.5 cursor-pointer"><Switch checked={isWon} onCheckedChange={setIsWon} /> Ganada</label>
        <label className="flex items-center gap-1.5 cursor-pointer"><Switch checked={isLost} onCheckedChange={setIsLost} /> Perdida</label>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-3.5 w-3.5" /> Cancelar</Button>
        <Button size="sm" onClick={() => name.trim() && onSave({ name: name.trim(), color, isDefault, isWon, isLost })}>
          <Check className="h-3.5 w-3.5" /> Guardar
        </Button>
      </div>
    </div>
  );
}

// Lightweight color helpers (lossy but fine for UI swatches)
function hslToHex(hsl: string): string {
  const m = hsl.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/);
  if (!m) return "#888888";
  const h = +m[1], s = +m[2] / 100, l = +m[3] / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + mm) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = ((b - r) / d + 2);
    else h = ((r - g) / d + 4);
    h *= 60;
  }
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}