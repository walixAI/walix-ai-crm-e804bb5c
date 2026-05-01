import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LeadStatus, Source } from "@/lib/contacts/badges";
import { useTenantUsers, resolveOwner, colorForUser, type TenantUser } from "@/lib/queries/tenantUsers";
import { buildContactSuggestions, type ContactSuggestion, type LastInbound } from "@/lib/contacts/suggestions";

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
  company: string | null;
  position: string | null;
  status: LeadStatus;
  source: Source;
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
    phone: r.phone,
    email: r.email,
    company: r.company,
    position: r.position,
    status: r.status,
    source: r.source,
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
  type: "wa_sent" | "wa_received" | "note" | "deal" | "task";
  description: string;
  timestamp: string;
  agent: string;
  agentInitials: string;
}

export function useContactActivity(contactId: string | undefined) {
  const { data: users } = useTenantUsers();
  return useQuery({
    queryKey: ["contact-activity", contactId, users?.length ?? 0],
    enabled: !!contactId,
    queryFn: async (): Promise<ActivityRow[]> => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("contact_id", contactId!)
        .order("occurred_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((a: any) => {
        const owner = resolveOwner(users, a.agent_id);
        return {
          id: a.id, type: a.type, description: a.description,
          timestamp: a.occurred_at,
          agent: owner.name === "Sin asignar" ? "Sistema" : owner.name,
          agentInitials: owner.initials === "—" ? "•" : owner.initials,
        };
      });
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
 * Local heuristic-based suggestions for a contact. Combines contact data,
 * deals, activity and last inbound message to surface the next best action.
 */
export function useContactSuggestions(contactId: string | undefined): {
  data: ContactSuggestion[];
  isLoading: boolean;
} {
  const { data: contact, isLoading: l1 } = useContact(contactId);
  const { data: deals = [], isLoading: l2 } = useContactDeals(contactId);
  const { data: activity = [], isLoading: l3 } = useContactActivity(contactId);
  const { data: lastInbound = null, isLoading: l4 } = useContactLastInbound(contactId);

  const isLoading = l1 || l2 || l3 || l4;
  if (!contact) return { data: [], isLoading };

  const suggestions = buildContactSuggestions({
    contact,
    activity,
    deals,
    lastInbound: lastInbound ?? null,
  });
  return { data: suggestions, isLoading };
}