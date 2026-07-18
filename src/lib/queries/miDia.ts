import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantId } from "@/lib/queries/tenant";

export interface JumboItem {
  id: string;
  kind: "task" | "deal_quote" | "deal_service" | "deal_followup" | "deal_collect";
  title: string;
  subtitle?: string | null;
  amount?: number | null;
  dueAt?: string | null;
  overdue?: boolean;
  contactId?: string | null;
  dealId?: string | null;
}

function isOverdue(d: string | null | undefined) {
  if (!d) return false;
  return new Date(d).getTime() < Date.now();
}

export function useMiDiaData() {
  const { user } = useAuth();
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["mi-dia", user?.id, tenantId],
    enabled: !!user?.id && !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
      const in7 = new Date(); in7.setDate(in7.getDate() + 7);

      const [tasksRes, dealsRes, stagesRes] = await Promise.all([
        supabase.from("tasks").select("id,title,due_at,completed,contact_id,deal_id,task_kind")
          .eq("completed", false).lte("due_at", endToday.toISOString())
          .order("due_at", { ascending: true }),
        supabase.from("deals").select("id,name,amount,stage_name,expected_close_date,payment_status,deal_type,service_type,scheduled_at,contact_id,is_won,is_lost,updated_at")
          .eq("is_won", false).eq("is_lost", false).limit(200),
        supabase.from("pipeline_stages").select("id,name,pipeline_id"),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (dealsRes.error) throw dealsRes.error;

      const tasks = tasksRes.data ?? [];
      const deals = dealsRes.data ?? [];

      // Collect contact ids to resolve names
      const contactIds = Array.from(new Set(
        [...tasks.map((t: any) => t.contact_id), ...deals.map((d: any) => d.contact_id)].filter(Boolean)
      ));
      let contactsById: Record<string, any> = {};
      if (contactIds.length) {
        const { data: cs } = await supabase.from("contacts").select("id,name,last_name,phone").in("id", contactIds as string[]);
        contactsById = Object.fromEntries((cs ?? []).map((c: any) => [c.id, c]));
      }

      const contactName = (id?: string | null) => {
        if (!id) return null;
        const c = contactsById[id];
        if (!c) return null;
        return `${c.name}${c.last_name ? " " + c.last_name : ""}`;
      };

      const tasksItems: JumboItem[] = tasks.map((t: any) => ({
        id: t.id,
        kind: "task",
        title: t.title,
        subtitle: contactName(t.contact_id),
        dueAt: t.due_at,
        overdue: isOverdue(t.due_at),
        contactId: t.contact_id,
        dealId: t.deal_id,
      }));

      const quote: JumboItem[] = deals
        .filter((d: any) => (d.deal_type ?? "venta") === "venta" && /cotiz/i.test(d.stage_name ?? ""))
        .map((d: any) => ({
          id: d.id, kind: "deal_quote",
          title: d.name, subtitle: contactName(d.contact_id),
          amount: Number(d.amount ?? 0), dealId: d.id, contactId: d.contact_id,
        }));

      const services: JumboItem[] = deals
        .filter((d: any) => d.deal_type === "servicio" && d.scheduled_at &&
          new Date(d.scheduled_at) <= endToday && new Date(d.scheduled_at) >= new Date(now.toDateString()))
        .map((d: any) => ({
          id: d.id, kind: "deal_service",
          title: d.name, subtitle: contactName(d.contact_id),
          dueAt: d.scheduled_at, dealId: d.id, contactId: d.contact_id,
        }));

      const collect: JumboItem[] = deals
        .filter((d: any) => d.payment_status === "pendiente" && d.expected_close_date &&
          new Date(d.expected_close_date) <= endToday)
        .map((d: any) => ({
          id: d.id, kind: "deal_collect",
          title: d.name, subtitle: contactName(d.contact_id),
          amount: Number(d.amount ?? 0), dueAt: d.expected_close_date,
          overdue: isOverdue(d.expected_close_date),
          dealId: d.id, contactId: d.contact_id,
        }));

      const followup: JumboItem[] = deals
        .filter((d: any) => /seguim/i.test(d.stage_name ?? "") ||
          /negoc/i.test(d.stage_name ?? ""))
        .slice(0, 10)
        .map((d: any) => ({
          id: d.id, kind: "deal_followup",
          title: d.name, subtitle: contactName(d.contact_id),
          amount: Number(d.amount ?? 0),
          dealId: d.id, contactId: d.contact_id,
        }));

      return {
        tasks: tasksItems,
        collect,
        quote,
        services,
        followup,
        totals: {
          tasks: tasksItems.length,
          overdueTasks: tasksItems.filter(t => t.overdue).length,
          quote: quote.length,
          services: services.length,
          collect: collect.length,
          collectAmount: collect.reduce((s, i) => s + (i.amount ?? 0), 0),
        },
      };
    },
  });
}

export function useQuickCreateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: { title: string; taskKind?: string; dueAt?: string | null; contactId?: string | null; dealId?: string | null }) => {
      if (!user?.id || !tenantId) throw new Error("Sin sesión");
      const { error } = await supabase.from("tasks").insert({
        tenant_id: tenantId,
        title: input.title,
        due_at: input.dueAt ?? null,
        assignee_id: user.id,
        contact_id: input.contactId ?? null,
        deal_id: input.dealId ?? null,
        task_kind: input.taskKind ?? "general",
        completed: false,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mi-dia"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useSetSimpleMode() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!user?.id) throw new Error("Sin sesión");
      const { data: prof } = await supabase.from("profiles").select("ui_prefs").eq("id", user.id).maybeSingle();
      const prefs = ((prof as any)?.ui_prefs ?? {}) as Record<string, unknown>;
      prefs.mode = enabled ? "simple" : "standard";
      const { error } = await supabase.from("profiles").update({ ui_prefs: prefs } as any).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-profile"] }),
  });
}