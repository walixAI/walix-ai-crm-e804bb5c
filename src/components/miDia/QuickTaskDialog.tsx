import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuickCreateTask } from "@/lib/queries/miDia";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function QuickTaskDialog({ open, onOpenChange }: Props) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("general");
  const [due, setDue] = useState("");
  const create = useQuickCreateTask();

  async function submit() {
    if (!title.trim()) { toast.error("Escribe qué hay que hacer"); return; }
    try {
      await create.mutateAsync({
        title: title.trim(),
        taskKind: kind,
        dueAt: due ? new Date(due).toISOString() : new Date().toISOString(),
      });
      toast.success("Tarea registrada");
      setTitle(""); setDue(""); setKind("general");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo registrar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Registrar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base">¿Qué hay que hacer?</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Cobrar a Don Luis" className="text-lg h-12" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="quote">Cotizar</SelectItem>
                  <SelectItem value="collect">Cobrar</SelectItem>
                  <SelectItem value="service">Servicio</SelectItem>
                  <SelectItem value="followup">Seguimiento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cuándo</Label>
              <Input type="datetime-local" value={due} onChange={e => setDue(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="lg" onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}