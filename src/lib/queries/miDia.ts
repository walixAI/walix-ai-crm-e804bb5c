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
  taskKind?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
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
        supabase.from("deals").select("id,name,amount,stage_name,expected_close_date,payment_status,deal_type,service_type,scheduled_at,contact_id,is_won,is_lost,updated_at,product_category_id")
          .eq("is_won", false).eq("is_lost", false).limit(1000),
        supabase.from("pipeline_stages").select("id,name,pipeline_id"),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (dealsRes.error) throw dealsRes.error;

      // Deduplica tareas idénticas (mismo contacto/oportunidad, título y vencimiento)
      const seenTasks = new Set<string>();
      const tasks = (tasksRes.data ?? []).filter((t: any) => {
        const key = `${t.contact_id ?? ""}|${t.deal_id ?? ""}|${t.title}|${t.due_at ?? ""}`;
        if (seenTasks.has(key)) return false;
        seenTasks.add(key);
        return true;
      });
      const deals = dealsRes.data ?? [];

      // Catálogo de categorías / productos del tenant
      const { data: cats } = await supabase.from("product_categories").select("id,name");
      const catName = (id?: string | null) => (id ? (cats ?? []).find((c: any) => c.id === id)?.name ?? null : null);

      // Oportunidades ligadas a las tareas (pueden estar cerradas y no venir arriba)
      const dealsById: Record<string, any> = Object.fromEntries(deals.map((d: any) => [d.id, d]));
      const missingDealIds = Array.from(new Set(
        tasks.map((t: any) => t.deal_id).filter((id: string | null) => id && !dealsById[id])
      )) as string[];
      if (missingDealIds.length) {
        const { data: extra } = await supabase.from("deals")
          .select("id,name,product_category_id").in("id", missingDealIds);
        for (const d of extra ?? []) dealsById[(d as any).id] = d;
      }

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

      const tasksItems: JumboItem[] = tasks.map((t: any) => {
        const deal = t.deal_id ? dealsById[t.deal_id] : null;
        return {
          id: t.id,
          kind: "task" as const,
          title: deal?.name ? `${deal.name} · ${t.title}` : `Sin Lead · ${t.title}`,
          subtitle: contactName(t.contact_id),
          dueAt: t.due_at,
          overdue: isOverdue(t.due_at),
          contactId: t.contact_id,
          dealId: t.deal_id,
          taskKind: t.task_kind ?? null,
          categoryId: deal?.product_category_id ?? null,
          categoryName: catName(deal?.product_category_id),
        };
      });

      const quote: JumboItem[] = deals
        .filter((d: any) => (d.deal_type ?? "venta") === "venta" && /cotiz/i.test(d.stage_name ?? ""))
        .map((d: any) => ({
          id: d.id, kind: "deal_quote",
          title: d.name, subtitle: contactName(d.contact_id),
          amount: Number(d.amount ?? 0), dealId: d.id, contactId: d.contact_id,
          categoryId: d.product_category_id ?? null, categoryName: catName(d.product_category_id),
        }));

      const services: JumboItem[] = deals
        .filter((d: any) => d.deal_type === "servicio" && d.scheduled_at &&
          new Date(d.scheduled_at) <= endToday && new Date(d.scheduled_at) >= new Date(now.toDateString()))
        .map((d: any) => ({
          id: d.id, kind: "deal_service",
          title: d.name, subtitle: contactName(d.contact_id),
          dueAt: d.scheduled_at, dealId: d.id, contactId: d.contact_id,
          categoryId: d.product_category_id ?? null, categoryName: catName(d.product_category_id),
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
          categoryId: d.product_category_id ?? null, categoryName: catName(d.product_category_id),
        }));

      // Seguimiento: toda oportunidad activa que no cayó en cotizar, servicio de hoy
      // ni cobro pendiente de hoy. Funciona con cualquier configuración de etapas.
      const usedIds = new Set([...quote, ...services, ...collect].map((i) => i.id));
      const followup: JumboItem[] = deals
        .filter((d: any) => !usedIds.has(d.id))
        .sort((a: any, b: any) =>
          new Date(a.updated_at ?? 0).getTime() - new Date(b.updated_at ?? 0).getTime())
        .map((d: any) => ({
          id: d.id, kind: "deal_followup",
          title: d.name,
          subtitle: [contactName(d.contact_id), d.stage_name].filter(Boolean).join(" · ") || null,
          amount: Number(d.amount ?? 0),
          dealId: d.id, contactId: d.contact_id,
          categoryId: d.product_category_id ?? null, categoryName: catName(d.product_category_id),
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
  return useQuickCreateTaskImpl();
}

/** Tareas abiertas de un día específico (distinto de hoy). */
export function useTasksByDate(date: Date | null) {
  const { user } = useAuth();
  const { data: tenantId } = useTenantId();
  const dayKey = date ? format(date, "yyyy-MM-dd") : null;
  return useQuery({
    queryKey: ["mi-dia-tasks-date", user?.id, tenantId, dayKey],
    enabled: !!user?.id && !!tenantId && !!date,
    staleTime: 60_000,
    queryFn: async (): Promise<JumboItem[]> => {
      const start = new Date(date!); start.setHours(0, 0, 0, 0);
      const end = new Date(date!); end.setHours(23, 59, 59, 999);
      const { data: rows, error } = await supabase
        .from("tasks")
        .select("id,title,due_at,completed,contact_id,deal_id,task_kind")
        .eq("completed", false)
        .gte("due_at", start.toISOString())
        .lte("due_at", end.toISOString())
        .order("due_at", { ascending: true });
      if (error) throw error;
      const tasks = rows ?? [];
      const dealIds = Array.from(new Set(tasks.map((t: any) => t.deal_id).filter(Boolean))) as string[];
      const contactIds = Array.from(new Set(tasks.map((t: any) => t.contact_id).filter(Boolean))) as string[];
      const [dealsRes, contactsRes, catsRes] = await Promise.all([
        dealIds.length ? supabase.from("deals").select("id,name,product_category_id").in("id", dealIds) : Promise.resolve({ data: [] } as any),
        contactIds.length ? supabase.from("contacts").select("id,name,last_name").in("id", contactIds) : Promise.resolve({ data: [] } as any),
        supabase.from("product_categories").select("id,name"),
      ]);
      const dealsById: Record<string, any> = Object.fromEntries(((dealsRes as any).data ?? []).map((d: any) => [d.id, d]));
      const contactsById: Record<string, any> = Object.fromEntries(((contactsRes as any).data ?? []).map((c: any) => [c.id, c]));
      const cats = (catsRes as any).data ?? [];
      const catName = (id?: string | null) => (id ? cats.find((c: any) => c.id === id)?.name ?? null : null);
      return tasks.map((t: any) => {
        const deal = t.deal_id ? dealsById[t.deal_id] : null;
        const c = t.contact_id ? contactsById[t.contact_id] : null;
        return {
          id: t.id,
          kind: "task" as const,
          title: deal?.name ? `${deal.name} · ${t.title}` : `Sin Lead · ${t.title}`,
          subtitle: c ? `${c.name}${c.last_name ? " " + c.last_name : ""}` : null,
          dueAt: t.due_at,
          overdue: isOverdue(t.due_at),
          contactId: t.contact_id,
          dealId: t.deal_id,
          taskKind: t.task_kind ?? null,
          categoryId: deal?.product_category_id ?? null,
          categoryName: catName(deal?.product_category_id),
        };
      });
    },
  });
}

function useQuickCreateTaskImpl() {
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
        task_kind: input.taskKind ?? "otro",
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