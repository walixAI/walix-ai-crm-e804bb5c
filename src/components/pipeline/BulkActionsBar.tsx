import { Trash2, X, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { PipelineStage } from "@/lib/queries/pipeline";

interface Props {
  selectedIds: string[];
  stages: PipelineStage[];
  onClear: () => void;
}

export function BulkActionsBar({ selectedIds, stages, onClear }: Props) {
  const [targetStage, setTargetStage] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [working, setWorking] = useState(false);
  const qc = useQueryClient();

  if (selectedIds.length === 0) return null;

  async function moveAll(stageId: string) {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return;
    setWorking(true);
    const { error } = await supabase
      .from("deals")
      .update({
        stage_id: stage.id,
        stage_name: stage.name,
        is_won: stage.isWon,
        is_lost: stage.isLost,
      })
      .in("id", selectedIds);
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success(`${selectedIds.length} oportunidades movidos a "${stage.name}"`);
    qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
    onClear();
    setTargetStage("");
  }

  async function deleteAll() {
    setWorking(true);
    const { error } = await supabase.from("deals").delete().in("id", selectedIds);
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success(`${selectedIds.length} oportunidades eliminados`);
    qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
    onClear();
    setConfirmDelete(false);
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-lg rounded-full pl-4 pr-2 py-2 flex items-center gap-3 animate-in slide-in-from-bottom-4">
        <span className="text-sm font-semibold">
          {selectedIds.length} {selectedIds.length === 1 ? "oportunidad seleccionada" : "oportunidades seleccionadas"}
        </span>

        <div className="h-5 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={targetStage} onValueChange={(v) => { setTargetStage(v); moveAll(v); }} disabled={working}>
            <SelectTrigger className="h-8 w-[180px] text-sm">
              <SelectValue placeholder="Mover a etapa…" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-danger hover:text-danger hover:bg-danger/10"
          onClick={() => setConfirmDelete(true)}
          disabled={working}
        >
          <Trash2 className="h-3.5 w-3.5" /> Eliminar
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedIds.length} deals?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los deals seleccionados se eliminarán permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAll} className="bg-danger hover:bg-danger/90 text-danger-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}