import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserCheck, Tag, Send, Download, Trash2, X, ListChecks } from "lucide-react";
import { ReassignPopover } from "./ReassignPopover";
import { ChangeStatusPopover } from "./ChangeStatusPopover";
import { TagsPopover } from "./TagsPopover";
import { ConfirmDialog } from "@/components/walix/ConfirmDialog";
import {
  useBulkUpdateContacts, useBulkDeleteContacts, useBulkAddTags,
} from "@/lib/queries/contacts";
import { toast } from "sonner";

interface Props {
  selectedIds: string[];
  onClear: () => void;
  onExport: () => void;
}

export function BulkActionsInline({ selectedIds, onClear, onExport }: Props) {
  const update = useBulkUpdateContacts();
  const addTags = useBulkAddTags();
  const remove = useBulkDeleteContacts();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (selectedIds.length === 0) return null;

  const reassign = (ownerId: string | null) =>
    update.mutate(
      { ids: selectedIds, patch: { owner_id: ownerId } },
      { onSuccess: () => toast.success(`${selectedIds.length} reasignados`) },
    );

  const changeStatus = (status: any) =>
    update.mutate(
      { ids: selectedIds, patch: { status } },
      { onSuccess: () => toast.success(`Status actualizado a "${status}"`) },
    );

  const tag = (name: string) =>
    addTags.mutate(
      { ids: selectedIds, tags: [name] },
      { onSuccess: () => toast.success(`Etiqueta "${name}" añadida`) },
    );

  const doDelete = () =>
    remove.mutate(selectedIds, {
      onSuccess: () => {
        toast.success(`${selectedIds.length} contactos eliminados`);
        onClear();
      },
    });

  return (
    <>
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 flex items-center gap-1 flex-wrap animate-in slide-in-from-top-2">
        <span className="text-sm font-medium px-2 inline-flex items-center gap-1.5">
          <ListChecks className="h-4 w-4 text-primary" />
          <strong>{selectedIds.length}</strong> seleccionados
        </span>
        <div className="h-5 w-px bg-border mx-1" />

        <ReassignPopover
          align="start"
          trigger={<Button variant="ghost" size="sm" className="h-8"><UserCheck className="h-3.5 w-3.5" /> Reasignar</Button>}
          onSelect={reassign}
        />
        <ChangeStatusPopover
          align="start"
          trigger={<Button variant="ghost" size="sm" className="h-8"><Tag className="h-3.5 w-3.5" /> Cambiar status</Button>}
          onSelect={changeStatus}
        />
        <TagsPopover
          align="start"
          current={[]}
          onToggle={(name, checked) => checked && tag(name)}
          trigger={<Button variant="ghost" size="sm" className="h-8"><Tag className="h-3.5 w-3.5" /> Etiquetar</Button>}
        />
        <Button variant="ghost" size="sm" className="h-8" onClick={() => toast.info("Próximamente: WA masivo con plantillas")}>
          <Send className="h-3.5 w-3.5" /> WA masivo
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={onExport}>
          <Download className="h-3.5 w-3.5" /> Exportar
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-3.5 w-3.5" /> Eliminar
        </Button>

        <button onClick={onClear} className="ml-auto text-muted-foreground hover:text-foreground p-1">
          <X className="h-4 w-4" />
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Eliminar ${selectedIds.length} contactos?`}
        description="Esta acción no se puede deshacer. Se eliminarán también sus actividades, tareas y conversaciones asociadas."
        confirmLabel="Eliminar"
        loading={remove.isPending}
        onConfirm={doDelete}
      />
    </>
  );
}