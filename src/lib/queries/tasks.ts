import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantUsers, resolveOwner, type TenantUser } from "@/lib/queries/tenantUsers";
import { aiMemory } from "@/services/aiMemory";

export interface TaskRow {
  id: string;
  title: string;
  completed: boolean;
  dueAt: string | null;
  assigneeId: string | null;
  assigneeName: string;
  assigneeInitials: string;
  contactId: string | null;
  contactName: string | null;
  dealId: string | null;
  createdAt: string;
}

export type TaskView = "today" | "upcoming" | "overdue" | "completed" | "all";

function map(t: any, contactsById: Record<string, any>, users?: TenantUser[]): TaskRow {
  const owner = resolveOwner(users, t.assignee_id);
  const c = t.contact_id ? contactsById[t.contact_id] : null;
  return {
    id: t.id,
    title: t.title,
    completed: t.completed,
    dueAt: t.due_at,
    assigneeId: t.assignee_id,
    assigneeName: owner.name,
    assigneeInitials: owner.initials,
    contactId: t.contact_id,
    contactName: c ? `${c.name}${c.last_name ? " " + c.last_name : ""}` : null,
    dealId: t.deal_id,
    createdAt: t.created_at,
  };
}

export function useTasks(opts: { view?: TaskView; mineOnly?: boolean } = {}) {
  const { view = "all", mineOnly = false } = opts;
  const { data: users } = useTenantUsers();
  return useQuery({
    queryKey: ["tasks", view, mineOnly, users?.length ?? 0],
    queryFn: async (): Promise<TaskRow[]> => {
      let q = supabase.from("tasks").select("*").limit(500);
      if (mineOnly) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user?.id) q = q.eq("assignee_id", auth.user.id);
      }
      const nowIso = new Date().toISOString();
      const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
      const in7 = new Date(); in7.setDate(in7.getDate() + 7);
      if (view === "today") q = q.eq("completed", false).gte("due_at", nowIso).lte("due_at", endOfDay.toISOString());
      else if (view === "upcoming") q = q.eq("completed", false).gte("due_at", nowIso).lte("due_at", in7.toISOString());
      else if (view === "overdue") q = q.eq("completed", false).lt("due_at", nowIso);
      else if (view === "completed") q = q.eq("completed", true);
      const { data, error } = await q.order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((t: any) => t.contact_id).filter(Boolean)));
      let contactsById: Record<string, any> = {};
      if (ids.length) {
        const { data: cs } = await supabase.from("contacts").select("id, name, last_name").in("id", ids as string[]);
        contactsById = Object.fromEntries((cs ?? []).map((c: any) => [c.id, c]));
      }
      return (data ?? []).map((t: any) => map(t, contactsById, users));
    },
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, completed, via, note,
    }: { id: string; completed: boolean; via?: "whatsapp" | "email" | "call" | "manual" | "auto" | "other"; note?: string }) => {
      const patch: any = { completed };
      if (completed) {
        patch.closed_via = via ?? "manual";
        patch.closed_note = note ?? null;
        patch.closed_at = new Date().toISOString();
      } else {
        patch.closed_via = null;
        patch.closed_note = null;
        patch.closed_at = null;
      }
      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select("contact_id, deal_id, title")
        .maybeSingle();
      if (error) throw error;
      if (completed && data) {
        const target = data.deal_id
          ? { type: "deal" as const, id: data.deal_id }
          : data.contact_id
          ? { type: "contact" as const, id: data.contact_id }
          : null;
        if (target) {
          void aiMemory.logEvent(target.type, target.id, "task_completed", {
            task_id: id,
            title: data.title,
            via: via ?? "manual",
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["contact-tasks"] });
      qc.invalidateQueries({ queryKey: ["contact-activity"] });
      qc.invalidateQueries({ queryKey: ["mi-dia"] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["contact-tasks"] });
      qc.invalidateQueries({ queryKey: ["contact-activity"] });
    },
  });
}

export function useRescheduleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dueAt, reason }: { id: string; dueAt: string | null; reason?: string }) => {
      const { data: row, error: qErr } = await supabase
        .from("tasks").select("tenant_id, contact_id, deal_id, title").eq("id", id).maybeSingle();
      if (qErr) throw qErr;
      const { error } = await supabase.from("tasks").update({ due_at: dueAt }).eq("id", id);
      if (error) throw error;
      if (reason && row?.contact_id && row?.tenant_id) {
        const { data: auth } = await supabase.auth.getUser();
        await (supabase as any).from("activities").insert({
          tenant_id: row.tenant_id,
          contact_id: row.contact_id,
          deal_id: row.deal_id ?? null,
          agent_id: auth.user?.id ?? null,
          type: "note",
          description: `Reagendé "${row.title}" — ${reason}`,
          occurred_at: new Date().toISOString(),
          metadata: { task_id: id, reschedule: true, new_due_at: dueAt },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["contact-tasks"] });
      qc.invalidateQueries({ queryKey: ["contact-activity"] });
      qc.invalidateQueries({ queryKey: ["mi-dia"] });
    },
  });
}