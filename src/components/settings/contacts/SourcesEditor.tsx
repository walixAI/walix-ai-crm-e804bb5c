import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import {
  useContactSources,
  useUpsertSource,
  useDeleteSource,
  type ContactSource,
} from "@/lib/queries/contactSources";
import { ConfirmDialog } from "@/components/walix/ConfirmDialog";

export function SourcesEditor() {
  const { data: sources = [], isLoading } = useContactSources();
  const upsert = useUpsertSource();
  const remove = useDeleteSource();
  const [editing, setEditing] = useState<ContactSource | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Fuentes de prospección</h3>
          <p className="text-xs text-muted-foreground">Define de dónde vienen tus contactos.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nueva fuente
        </Button>
      </div>
      <div className="divide-y divide-border">
        {isLoading && <div className="p-4 text-sm text-muted-foreground">Cargando…</div>}
        {creating && (
          <SourceRow
            source={null}
            onCancel={() => setCreating(false)}
            onSave={async (patch) => {
              await upsert.mutateAsync({ ...patch, position: sources.length });
              toast.success("Fuente creada");
              setCreating(false);
            }}
          />
        )}
        {sources.map((s) => (
          editing?.id === s.id ? (
            <SourceRow
              key={s.id}
              source={s}
              onCancel={() => setEditing(null)}
              onSave={async (patch) => {
                await upsert.mutateAsync({ id: s.id, position: s.position, ...patch });
                toast.success("Fuente actualizada");
                setEditing(null);
              }}
            />
          ) : (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-sm font-medium flex-1">{s.name}</span>
              <Button size="icon" variant="ghost" onClick={() => setEditing(s)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setDeleteId(s.id)} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )
        ))}
        {!isLoading && sources.length === 0 && !creating && (
          <div className="p-6 text-center text-sm text-muted-foreground">Aún no hay fuentes. Crea la primera.</div>
        )}
      </div>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="Eliminar fuente"
        description="¿Seguro que deseas eliminar esta fuente?"
        confirmLabel="Eliminar"
        destructive
        onConfirm={async () => {
          if (!deleteId) return;
          await remove.mutateAsync(deleteId);
          toast.success("Fuente eliminada");
          setDeleteId(null);
        }}
      />
    </div>
  );
}

function SourceRow({
  source, onSave, onCancel,
}: {
  source: ContactSource | null;
  onSave: (patch: { name: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(source?.name ?? "");
  return (
    <div className="px-4 py-3 bg-muted/30 flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="flex-1" autoFocus />
      <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-3.5 w-3.5" /> Cancelar</Button>
      <Button size="sm" onClick={() => name.trim() && onSave({ name: name.trim() })}>
        <Check className="h-3.5 w-3.5" /> Guardar
      </Button>
    </div>
  );
}