import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ContactLifecycle, Source } from "@/lib/contacts/badges";
import { useTenantUsers, resolveOwner, colorForUser, type TenantUser } from "@/lib/queries/tenantUsers";
import { buildContactSuggestions, type ContactSuggestion, type LastInbound } from "@/lib/contacts/suggestions";
import { useTenantId } from "@/lib/queries/tenant";

const colors = [
  "hsl(239 84% 60%)",
  "hsl(189 94% 43%)",
  "hsl(38 92% 50%)",
  "hsl(142 71% 45%)",
  "hsl(280 70% 55%)",
  "hsl(0 75% 60%)",
];

export interface ContactRow {
  id: string;
  name: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  phoneAlt: string | null;
  address: string | null;
  notes: string | null;
  company: string | null;
  companyId: string | null;
  position: string | null;
  status: ContactLifecycle;
  source: Source;
  sourceId: string | null;
  tags: string[];
  ownerId: string | null;
  ownerName: string;
  ownerInitials: string;
  avatarColor: string;
  lastActivity: string;
  createdAt: string;
}

function colorFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function mapContact(r: any, users?: TenantUser[]): ContactRow {
  const owner = resolveOwner(users, r.owner_id);
  return {
    id: r.id,
    name: r.name,
    lastName: r.last_name,
    phone: r.phone ?? "",
    email: r.email,
    phoneAlt: r.phone_alt ?? null,
    address: r.address ?? null,
    notes: r.notes ?? null,
    company: r.company,
    companyId: r.company_id ?? null,
    position: r.position,
    status: r.status,
    source: r.source,
    sourceId: r.source_id ?? null,
    tags: r.tags ?? [],
    ownerId: r.owner_id,
    ownerName: owner.name,
    ownerInitials: owner.initials,
    avatarColor: r.avatar_color ?? colorFromId(r.id),
    lastActivity: r.last_activity_at ?? r.updated_at ?? r.created_at,
    createdAt: r.created_at,
  };
}

export function useContacts() {
  const { data: users } = useTenantUsers();
  return useQuery({
    queryKey: ["contacts", users?.length ?? 0],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("last_activity_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((r) => mapContact(r, users));
    },
  });
}

export function useContact(id: string | undefined) {
  const { data: users } = useTenantUsers();
  return useQuery({
    queryKey: ["contact", id, users?.length ?? 0],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapContact(data, users) : null;
    },
  });
}

// ===== CRUD mutations =====

export interface ContactInput {
  name?: string;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  phone_alt?: string | null;
  address?: string | null;
  notes?: string | null;
  company?: string | null;
  company_id?: string | null;
  position?: string | null;
  status?: ContactLifecycle;
  source?: Source;
  source_id?: string | null;
  tags?: string[];
  owner_id?: string | null;
}

export function useCreateContact() {
  const { data: tenantId } = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContactInput & { name: string }) => {
      if (!tenantId) throw new Error("Sin tenant");
      const payload: any = { tenant_id: tenantId, ...input };
      // contacts.phone is now nullable; coerce empty string to null
      if (!payload.phone) payload.phone = null;
      const { data, error } = await supabase
        .from("contacts")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ContactInput }) => {
      const { error } = await supabase.from("contacts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["contact", id] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useBulkUpdateContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: ContactInput }) => {
      const { error } = await supabase.from("contacts").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

/**
 * Adds tags (union) to many contacts in one go. Reads current tags first to merge.
 */
export function useBulkAddTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, tags }: { ids: string[]; tags: string[] }) => {
      if (ids.length === 0 || tags.length === 0) return;
      const { data, error } = await supabase.from("contacts").select("id, tags").in("id", ids);
      if (error) throw error;
      for (const row of data ?? []) {
        const merged = Array.from(new Set([...(row.tags ?? []), ...tags]));
        const { error: uerr } = await supabase.from("contacts").update({ tags: merged }).eq("id", row.id);
        if (uerr) throw uerr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useBulkDeleteContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from("contacts").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export interface DealRow {
  id: string;
  name: string;
  amount: number;
  stage: string;
  probability: number;
  contactId: string | null;
  isWon: boolean;
  isLost: boolean;
  createdAt: string;
}

export function useContactDeals(contactId: string | undefined) {
  return useQuery({
    queryKey: ["contact-deals", contactId],
    enabled: !!contactId,
    queryFn: async (): Promise<DealRow[]> => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        id: d.id, name: d.name, amount: Number(d.amount),
        stage: d.stage_name ?? "—", probability: d.probability,
        contactId: d.contact_id, isWon: d.is_won, isLost: d.is_lost, createdAt: d.created_at,
      }));
    },
  });
}

export interface ActivityRow {
  id: string;
  type: "wa_sent" | "wa_received" | "note" | "deal" | "task" | "call" | "meeting" | "email" | "manual";
  description: string;
  timestamp: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string | null;
  metadata: Record<string, any>;
  agent: string;
  agentInitials: string;
  agentId: string | null;
}

export function useContactActivity(contactId: string | undefined) {
  const { data: users } = useTenantUsers();
  return useQuery({
    queryKey: ["contact-activity", contactId, users?.length ?? 0],
    enabled: !!contactId,
    queryFn: async (): Promise<ActivityRow[]> => {
      const [{ data: actData, error: actErr }, { data: taskData, error: taskErr }] = await Promise.all([
        supabase
        .from("activities")
        .select("*")
        .eq("contact_id", contactId!)
        .order("occurred_at", { ascending: false })
          .limit(20),
        supabase
          .from("tasks")
          .select("*")
          .eq("contact_id", contactId!)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (actErr) throw actErr;
      if (taskErr) throw taskErr;
      const acts: ActivityRow[] = (actData ?? []).map((a: any) => {
        const owner = resolveOwner(users, a.agent_id);
        return {
          id: a.id, type: a.type, description: a.description,
          timestamp: a.occurred_at,
          occurredAt: a.occurred_at,
          createdAt: a.created_at,
          updatedAt: a.updated_at ?? null,
          metadata: (a.metadata as Record<string, any>) ?? {},
          agent: owner.name === "Sin asignar" ? "Sistema" : owner.name,
          agentInitials: owner.initials === "—" ? "•" : owner.initials,
          agentId: a.agent_id ?? null,
        };
      });
      const taskActs: ActivityRow[] = (taskData ?? []).map((t: any) => {
        const owner = resolveOwner(users, t.assignee_id);
        const when = t.due_at ?? t.created_at;
        return {
          id: `task-${t.id}`,
          type: "task",
          description: t.title,
          timestamp: when,
          occurredAt: when,
          createdAt: t.created_at,
          updatedAt: t.updated_at ?? null,
          metadata: { taskId: t.id, completed: t.completed, dueAt: t.due_at },
          agent: owner.name === "Sin asignar" ? "Sistema" : owner.name,
          agentInitials: owner.initials === "—" ? "•" : owner.initials,
          agentId: t.assignee_id ?? null,
        };
      });
      return [...acts, ...taskActs].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      );
    },
  });
}

export interface ConversationRow {
  id: string;
  preview: string;
  time: string;
  unread: number;
  lastAt: string;
}

export function useContactConversations(contactId: string | undefined) {
  return useQuery({
    queryKey: ["contact-conversations", contactId],
    enabled: !!contactId,
    queryFn: async (): Promise<ConversationRow[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", contactId!)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        id: c.id, preview: c.preview ?? "(sin mensajes)",
        time: c.last_message_at ?? c.updated_at,
        unread: c.unread_count ?? 0, lastAt: c.last_message_at ?? c.created_at,
      }));
    },
  });
}

export interface ContactStatsValue {
  pipelineValue: number;
  probability: number;
  lastContactAt: string | null;
  customerSince: string;
}

export function useContactStats(contactId: string | undefined, lastActivityIso?: string, createdAtIso?: string) {
  const { data: deals } = useContactDeals(contactId);
  const pipelineValue = (deals ?? []).reduce((s, d) => s + d.amount, 0);
  const probability = deals && deals.length
    ? Math.round(deals.reduce((s, d) => s + d.probability, 0) / deals.length) : 0;
  return {
    pipelineValue,
    probability,
    lastContactAt: lastActivityIso ?? null,
    customerSince: createdAtIso
      ? new Date(createdAtIso).toLocaleDateString("es-MX", { month: "short", year: "numeric" })
      : "—",
  } as ContactStatsValue;
}

export interface AiSuggestionRow {
  id: string;
  text: string;
  cta: string | null;
  contactId: string | null;
}

export function useContactAiSuggestions(contactId: string | undefined) {
  return useQuery({
    queryKey: ["contact-ai", contactId],
    enabled: !!contactId,
    queryFn: async (): Promise<AiSuggestionRow[]> => {
      const { data, error } = await supabase
        .from("ai_suggestions")
        .select("*")
        .eq("contact_id", contactId!)
        .eq("dismissed", false)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        id: s.id, text: s.text, cta: s.cta, contactId: s.contact_id,
      }));
    },
  });
}

/**
 * Returns the last inbound (received) WhatsApp timestamp for the contact and
 * the last outbound (sent) timestamp, used to detect unanswered messages.
 */
export function useContactLastInbound(contactId: string | undefined) {
  return useQuery({
    queryKey: ["contact-last-inbound", contactId],
    enabled: !!contactId,
    queryFn: async (): Promise<LastInbound | null> => {
      // Resolve conversation ids first (avoids a join requirement).
      const { data: convs, error: convErr } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", contactId!);
      if (convErr) throw convErr;
      const ids = (convs ?? []).map((c: any) => c.id);
      if (ids.length === 0) return null;

      const { data: inbound } = await supabase
        .from("messages")
        .select("sent_at")
        .in("conversation_id", ids)
        .eq("direction", "inbound")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!inbound) return null;

      const { data: outbound } = await supabase
        .from("messages")
        .select("sent_at")
        .in("conversation_id", ids)
        .eq("direction", "outbound")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        receivedAt: inbound.sent_at as string,
        lastOutboundAt: (outbound?.sent_at as string | undefined) ?? null,
      };
    },
  });
}

/**
 * Suggestions for a contact. Tries the AI-powered edge function first
 * (`contact-ai-suggest`) and falls back to local heuristics on failure or
 * while loading. The contract is always `ContactSuggestion[]`.
 */
export function useContactSuggestions(contactId: string | undefined): {
  data: ContactSuggestion[];
  isLoading: boolean;
  source: "ai" | "local" | "none";
} {
  const { data: contact, isLoading: l1 } = useContact(contactId);
  const { data: deals = [], isLoading: l2 } = useContactDeals(contactId);
  const { data: activity = [], isLoading: l3 } = useContactActivity(contactId);
  const { data: lastInbound = null, isLoading: l4 } = useContactLastInbound(contactId);

  // AI call — cached 5 min, retried once. Errors are swallowed so we always fall back.
  const ai = useQuery({
    queryKey: ["contact-ai-suggest", contactId],
    enabled: !!contactId && !!contact,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<ContactSuggestion[] | null> => {
      try {
        const { data, error } = await supabase.functions.invoke("contact-ai-suggest", {
          body: { contactId },
        });
        if (error) return null;
        const list = (data as any)?.suggestions;
        if (!Array.isArray(list) || list.length === 0) return null;
        return list as ContactSuggestion[];
      } catch {
        return null;
      }
    },
  });

  const baseLoading = l1 || l2 || l3 || l4;
  if (!contact) return { data: [], isLoading: baseLoading, source: "none" };

  // Always compute a local fallback so the UI is never empty.
  const local = buildContactSuggestions({
    contact,
    activity,
    deals,
    lastInbound: lastInbound ?? null,
  });

  if (ai.data && ai.data.length > 0) {
    return { data: ai.data, isLoading: false, source: "ai" };
  }
  return {
    data: local,
    isLoading: baseLoading || ai.isLoading,
    source: "local",
  };
}

// ===== Tasks =====

export interface ContactTaskRow {
  id: string;
  title: string;
  completed: boolean;
  dueAt: string | null;
  assigneeId: string | null;
  dealId: string | null;
  createdAt: string;
  taskKind: string | null;
  closedVia: string | null;
  closedNote: string | null;
  closedAt: string | null;
}

export function useContactTasks(contactId: string | undefined) {
  return useQuery({
    queryKey: ["contact-tasks", contactId],
    enabled: !!contactId,
    queryFn: async (): Promise<ContactTaskRow[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("contact_id", contactId!)
        .order("completed", { ascending: true })
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        dueAt: t.due_at,
        assigneeId: t.assignee_id,
        dealId: t.deal_id,
        createdAt: t.created_at,
        taskKind: t.task_kind ?? null,
        closedVia: t.closed_via ?? null,
        closedNote: t.closed_note ?? null,
        closedAt: t.closed_at ?? null,
      }));
    },
  });
}

export function useToggleContactTask(contactId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, completed, via, note,
    }: {
      id: string; completed: boolean;
      via?: "whatsapp" | "email" | "call" | "manual" | "auto" | "other";
      note?: string;
    }) => {
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
      const { error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-tasks", contactId] });
      qc.invalidateQueries({ queryKey: ["contact-activity", contactId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["mi-dia"] });
    },
  });
}

export function useDeleteContactTask(contactId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-tasks", contactId] });
      qc.invalidateQueries({ queryKey: ["contact-activity", contactId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// ===== Activity / Notes mutations =====

export type ManualActivityType = "note" | "call" | "meeting" | "email" | "manual";

export function useCreateContactActivity(contactId: string | undefined) {
  const { data: tenantId } = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      type: ManualActivityType;
      description: string;
      dealId?: string | null;
      occurredAt?: string;
      metadata?: Record<string, any>;
    }) => {
      if (!tenantId || !contactId) throw new Error("Tenant o contacto no disponible");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("activities").insert({
        tenant_id: tenantId,
        contact_id: contactId,
        deal_id: input.dealId ?? null,
        agent_id: auth.user?.id ?? null,
        type: input.type,
        description: input.description,
        occurred_at: input.occurredAt ?? new Date().toISOString(),
        metadata: input.metadata ?? {},
      });
      if (error) throw error;
      // touch contact.last_activity_at
      await supabase
        .from("contacts")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", contactId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-activity", contactId] });
      qc.invalidateQueries({ queryKey: ["contact", contactId] });
    },
  });
}

export function useUpdateContactActivity(contactId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      description?: string;
      occurredAt?: string;
      metadata?: Record<string, any>;
      type?: ManualActivityType;
    }) => {
      const patch: any = {};
      if (input.description !== undefined) patch.description = input.description;
      if (input.occurredAt !== undefined) patch.occurred_at = input.occurredAt;
      if (input.metadata !== undefined) patch.metadata = input.metadata;
      if (input.type !== undefined) patch.type = input.type;
      const { error } = await (supabase as any).from("activities").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-activity", contactId] }),
  });
}

export function useDeleteContactActivity(contactId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-activity", contactId] }),
  });
}