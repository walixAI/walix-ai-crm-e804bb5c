import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sellers } from "@/mock/contacts";

// ───────────────────────── helpers ─────────────────────────
function ownerFromId(ownerId: string | null) {
  if (!ownerId) return { id: null, name: "Sin asignar", initials: "—", color: "hsl(var(--muted-foreground))" };
  let h = 0;
  for (let i = 0; i < ownerId.length; i++) h = (h * 31 + ownerId.charCodeAt(i)) >>> 0;
  const s = sellers[h % sellers.length];
  return { id: ownerId, name: s.name, initials: s.initials, color: s.color };
}

const colors = [
  "hsl(239 84% 60%)", "hsl(189 94% 43%)", "hsl(38 92% 50%)",
  "hsl(142 71% 45%)", "hsl(280 70% 55%)", "hsl(0 75% 60%)",
];
function colorFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

// ───────────────────────── types ─────────────────────────
export type ConversationStatus = "Nuevo" | "En atención" | "Esperando" | "Resuelto";
export type MessageType = "text" | "image" | "document" | "audio" | "location";
export type MessageDirection = "inbound" | "outbound";

export interface ConversationItem {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  contactCompany: string | null;
  contactStatus: string;
  avatarColor: string;
  initials: string;
  preview: string;
  unread: number;
  lastAt: string | null;
  status: ConversationStatus;
  assigneeId: string | null;
  assigneeName: string;
  assigneeInitials: string;
  assigneeColor: string;
  dealId: string | null;
  internalNotes: string | null;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  body: string;
  type: MessageType;
  mediaUrl: string | null;
  isInternalNote: boolean;
  readAt: string | null;
  sentAt: string;
  metadata: any;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string | null;
}

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "•";
}

// ───────────────────────── queries ─────────────────────────
export function useConversations() {
  const qc = useQueryClient();

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel("wa-conv-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["wa-conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["wa-conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return useQuery({
    queryKey: ["wa-conversations"],
    queryFn: async (): Promise<ConversationItem[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, contact_id, preview, unread_count, last_message_at,
          status, assignee_id, deal_id, internal_notes, updated_at, created_at,
          contacts:contact_id ( id, name, last_name, phone, company, status, avatar_color )
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((c: any) => {
        const contact = c.contacts ?? {};
        const fullName = [contact.name, contact.last_name].filter(Boolean).join(" ") || "Contacto";
        const owner = ownerFromId(c.assignee_id);
        return {
          id: c.id,
          contactId: c.contact_id,
          contactName: fullName,
          contactPhone: contact.phone ?? "",
          contactCompany: contact.company ?? null,
          contactStatus: contact.status ?? "Nuevo",
          avatarColor: contact.avatar_color ?? colorFromId(c.contact_id ?? c.id),
          initials: initialsOf(fullName),
          preview: c.preview ?? "(sin mensajes)",
          unread: c.unread_count ?? 0,
          lastAt: c.last_message_at ?? c.updated_at ?? c.created_at,
          status: (c.status ?? "Nuevo") as ConversationStatus,
          assigneeId: c.assignee_id,
          assigneeName: owner.name,
          assigneeInitials: owner.initials,
          assigneeColor: owner.color,
          dealId: c.deal_id,
          internalNotes: c.internal_notes,
        };
      });
    },
  });
}

export function useMessages(conversationId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`wa-msgs-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["wa-messages", conversationId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, qc]);

  return useQuery({
    queryKey: ["wa-messages", conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<MessageItem[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("sent_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        id: m.id,
        conversationId: m.conversation_id,
        direction: m.direction,
        body: m.body,
        type: (m.type ?? "text") as MessageType,
        mediaUrl: m.media_url,
        isInternalNote: !!m.is_internal_note,
        readAt: m.read_at,
        sentAt: m.sent_at ?? m.created_at,
        metadata: m.metadata ?? null,
      }));
    },
  });
}

export function useMessageTemplates() {
  return useQuery({
    queryKey: ["wa-templates"],
    queryFn: async (): Promise<MessageTemplate[]> => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id, name, content, category")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ───────────────────────── mutations ─────────────────────────
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      conversationId: string;
      tenantId: string;
      body: string;
      isInternalNote?: boolean;
    }) => {
      const { error } = await supabase.from("messages").insert({
        conversation_id: input.conversationId,
        tenant_id: input.tenantId,
        direction: "outbound",
        body: input.body,
        type: "text",
        is_internal_note: !!input.isInternalNote,
        sent_at: new Date().toISOString(),
      });
      if (error) throw error;
      // update preview + last_message_at
      if (!input.isInternalNote) {
        await supabase
          .from("conversations")
          .update({
            preview: input.body.slice(0, 120),
            last_message_at: new Date().toISOString(),
          })
          .eq("id", input.conversationId);
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["wa-messages", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["wa-conversations"] });
    },
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Partial<{
        status: ConversationStatus;
        assignee_id: string | null;
        deal_id: string | null;
        internal_notes: string;
        unread_count: number;
      }>;
    }) => {
      const { error } = await supabase.from("conversations").update(input.patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-conversations"] });
    },
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("conversations").update({ unread_count: 0 }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-conversations"] }),
  });
}

export function useMarkConversationUnread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("conversations").update({ unread_count: 1 }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-conversations"] }),
  });
}

// ───────────────── templates CRUD ─────────────────
export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tenantId: string; name: string; content: string; category?: string | null }) => {
      const { data, error } = await supabase
        .from("message_templates")
        .insert({
          tenant_id: input.tenantId,
          name: input.name,
          content: input.content,
          category: input.category ?? null,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<{ name: string; content: string; category: string | null }> }) => {
      const { error } = await supabase.from("message_templates").update(input.patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("message_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-templates"] }),
  });
}

// ───────────────── search inside messages ─────────────────
/** Returns the set of conversation_ids whose messages contain `term`. */
export function useMessageSearch(term: string) {
  return useQuery({
    queryKey: ["wa-msg-search", term],
    enabled: term.trim().length >= 2,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("messages")
        .select("conversation_id")
        .ilike("body", `%${term.trim()}%`)
        .limit(500);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.conversation_id));
    },
    staleTime: 10_000,
  });
}

// ───────────────── link / create deal ─────────────────
export function useLinkDealToConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { conversationId: string; dealId: string | null }) => {
      const { error } = await supabase
        .from("conversations")
        .update({ deal_id: input.dealId })
        .eq("id", input.conversationId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-conversations"] }),
  });
}

/** Helper: replace template variables with conversation context. */
export function renderTemplate(
  content: string,
  ctx: { nombre?: string; empresa?: string; vendedor?: string; monto?: string | number | null },
) {
  const monto =
    ctx.monto == null
      ? "—"
      : typeof ctx.monto === "number"
        ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(ctx.monto)
        : String(ctx.monto);
  return content
    .replaceAll("{nombre}", ctx.nombre ?? "")
    .replaceAll("{empresa}", ctx.empresa ?? "")
    .replaceAll("{vendedor}", ctx.vendedor ?? "")
    .replaceAll("{monto}", monto);
}