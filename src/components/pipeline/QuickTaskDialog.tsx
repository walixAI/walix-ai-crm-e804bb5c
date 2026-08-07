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
import { useContactPipelineDeals, useStages } from "@/lib/queries/pipeline";
import { NewDealDialog } from "@/components/pipeline/NewDealDialog";
import { useTenantUsers } from "@/lib/queries/tenantUsers";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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
  /** When provided, the dialog enters EDIT mode for this task. */
  task?: {
    id: string;
    title: string;
    dueAt: string | null;
    assigneeId: string | null;
    contactId: string | null;
    dealId: string | null;
  } | null;
  onClose: () => void;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function QuickTaskDialog({ open, deal, contactId, defaultTitle, task, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [dealId, setDealId] = useState<string | null>(null);
  const [showDealPicker, setShowDealPicker] = useState(false);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const { data: tenantId } = useTenantId();
  const { data: users = [] } = useTenantUsers();
  const qc = useQueryClient();
  const { user } = useAuth();
  const editing = !!task;

  // Sólo se pregunta la oportunidad cuando la tarea nace desde un contacto.
  const askDeal = !editing && !deal && !!contactId;
  const { data: contactDeals = [] } = useContactPipelineDeals(askDeal && open ? contactId ?? undefined : undefined);
  const { data: allStages = [] } = useStages(null);
  const openDeals = contactDeals.filter((d: any) => !d.isWon && !d.isLost);

  useEffect(() => {
    if (!askDeal || !open) return;
    if (openDeals.length === 1 && !dealId) setDealId(openDeals[0].id);
  }, [askDeal, open, openDeals.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDue(toLocalInput(task.dueAt));
      setAssigneeId(task.assigneeId ?? "");
    } else {
      setTitle(defaultTitle ?? "");
      setDue("");
      setAssigneeId(user?.id ?? "");
    }
    setDealId(null);
    setShowDealPicker(false);
  }, [open, defaultTitle, task, user?.id]);

  async function save() {
    if (!tenantId) return;
    const parsed = schema.safeParse({ title, due });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const dueIso = parsed.data.due ? new Date(parsed.data.due).toISOString() : null;
    let error: any = null;
    if (editing && task) {
      const res = await supabase.from("tasks").update({
        title: parsed.data.title,
        due_at: dueIso,
        assignee_id: assigneeId || null,
      }).eq("id", task.id);
      error = res.error;
    } else {
      const res = await supabase.from("tasks").insert({
        tenant_id: tenantId,
        deal_id: deal?.id ?? dealId ?? null,
        contact_id: deal?.contactId ?? contactId ?? null,
        title: parsed.data.title,
        due_at: dueIso,
        assignee_id: assigneeId || user?.id || null,
      });
      error = res.error;
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Tarea actualizada" : "Tarea creada");
    qc.invalidateQueries({ queryKey: ["pipeline-deal-tasks-map"] });
    qc.invalidateQueries({ queryKey: ["contact-activity", contactId] });
    qc.invalidateQueries({ queryKey: ["contact-tasks", contactId] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {askDeal && (
            showDealPicker || openDeals.length > 1 ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Oportunidad</Label>
                <Select
                  value={dealId ?? "none"}
                  onValueChange={(v) => {
                    if (v === "__new") { setNewDealOpen(true); return; }
                    setDealId(v === "none" ? null : v);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin oportunidad</SelectItem>
                    {openDeals.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                    <SelectItem value="__new">+ Nueva oportunidad…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Oportunidad</div>
                  <div className="text-sm font-medium truncate">
                    {dealId
                      ? openDeals.find((d: any) => d.id === dealId)?.name ?? "Oportunidad"
                      : "Sin oportunidad (prospección)"}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!dealId && openDeals.length === 0 && (
                    <Button variant="outline" size="sm" onClick={() => setNewDealOpen(true)}>Crear</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setShowDealPicker(true)}>Cambiar</Button>
                </div>
              </div>
            )
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Llamar al cliente…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vence (opcional)</Label>
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Asignado a</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={loading}>{loading ? "Guardando…" : (editing ? "Guardar" : "Crear")}</Button>
        </DialogFooter>
      </DialogContent>
      <NewDealDialog
        open={newDealOpen}
        onOpenChange={setNewDealOpen}
        stages={allStages}
        defaultContactId={contactId ?? null}
        onCreated={(id) => { setDealId(id); setShowDealPicker(false); }}
      />
    </Dialog>
  );
}