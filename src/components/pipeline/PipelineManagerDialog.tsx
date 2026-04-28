import { useState } from "react";
import { z } from "zod";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WBadge } from "@/components/walix/Badge";
import {
  usePipelines, useCreatePipeline, useRenamePipeline, useDeletePipeline,
  type Pipeline,
} from "@/lib/queries/pipeline";

const nameSchema = z.string().trim().min(1, "Nombre requerido").max(60, "Máximo 60 caracteres");

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function PipelineManagerDialog({ open, onClose, onSelect }: Props) {
  const { data: pipelines = [] } = usePipelines();
  const createMut = useCreatePipeline();
  const renameMut = useRenamePipeline();
  const deleteMut = useDeletePipeline();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Pipeline | null>(null);

  async function handleCreate() {
    const parsed = nameSchema.safeParse(newName);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    try {
      const res = await createMut.mutateAsync(parsed.data);
      toast.success("Pipeline creado");
      setNewName("");
      if (res?.id) onSelect(res.id);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al crear");
    }
  }

  async function handleRename(id: string) {
    const parsed = nameSchema.safeParse(editingName);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    try {
      await renameMut.mutateAsync({ id, name: parsed.data });
      toast.success("Pipeline renombrado");
      setEditingId(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al renombrar");
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteMut.mutateAsync(confirmDelete.id);
      toast.success("Pipeline eliminado");
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al eliminar");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gestionar pipelines</DialogTitle>
            <DialogDescription>
              Crea, renombra o elimina pipelines para distintos flujos de venta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {pipelines.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                {editingId === p.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value.slice(0, 60))}
                      maxLength={60}
                      className="h-8"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(p.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRename(p.id)}>
                      <Check className="h-3.5 w-3.5 text-success" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                    {p.isDefault && <WBadge variant="brand">Default</WBadge>}
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => { setEditingId(p.id); setEditingName(p.name); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!p.isDefault && (
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-danger hover:text-danger"
                        onClick={() => setConfirmDelete(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <Label className="text-xs">Nuevo pipeline</Label>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value.slice(0, 60))}
                placeholder="Ej. Renovaciones B2B"
                maxLength={60}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
              <Button onClick={handleCreate} disabled={createMut.isPending || !newName.trim()}>
                <Plus className="h-3.5 w-3.5" /> Crear
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              El nuevo pipeline se crea sin etapas. Podrás añadirlas próximamente.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el pipeline y todas sus etapas. Los deals asociados quedarán sin etapa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-danger hover:bg-danger/90 text-danger-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}