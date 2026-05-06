import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import type { PipelineDeal } from "@/lib/queries/pipeline";

const schema = z.object({
  title: z.string().trim().min(1, "Título requerido").max(120, "Máximo 120 caracteres"),
  due: z.string().optional(),
});

interface Props {
  open: boolean;
  deal?: PipelineDeal | null;
  /** Optional contact id when creating a contact-only task (no deal). */
  contactId?: string | null;
  /** Optional pre-filled title. */
  defaultTitle?: string;
  onClose: () => void;
}

export function QuickTaskDialog({ open, deal, contactId, defaultTitle, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: tenantId } = useTenantId();
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (open) { setTitle(defaultTitle ?? ""); setDue(""); }
  }, [open, defaultTitle]);

  async function save() {
    if (!tenantId) return;
    if (!deal && !contactId) return;
    const parsed = schema.safeParse({ title, due });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.from("tasks").insert({
      tenant_id: tenantId,
      deal_id: deal?.id ?? null,
      contact_id: deal?.contactId ?? contactId ?? null,
      title: parsed.data.title,
      due_at: parsed.data.due ? new Date(parsed.data.due).toISOString() : null,
      assignee_id: user?.id ?? null,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Tarea creada");
    qc.invalidateQueries({ queryKey: ["pipeline-deal-tasks-map"] });
    qc.invalidateQueries({ queryKey: ["contact-activity", contactId] });
    qc.invalidateQueries({ queryKey: ["contact-tasks", contactId] });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Llamar al cliente…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vence (opcional)</Label>
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={loading}>{loading ? "Guardando…" : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}