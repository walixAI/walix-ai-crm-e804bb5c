import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Propuestas de Walix IA.
 *
 * Las automatizaciones no crean tareas directamente: insertan una propuesta en
 * `ai_proactive_suggestions` con `action_type = 'propose_task'`. El usuario la
 * acepta (se crea la tarea real) o la rechaza (se descarta y no se repite).
 */

export interface ProposalPayload {
  title?: string;
  subtitle?: string;
  due_at?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
  assignee_id?: string | null;
  task_kind?: string | null;
  icon?: "wrench" | "clock" | "phone" | "calendar" | null;
}

export interface AiProposal {
  id: string;
  tenantId: string;
  text: string;
  payload: ProposalPayload;
  entityType: string | null;
  entityId: string | null;
  priority: number;
  isNew: boolean;
  createdAt: string;
}

export const PROPOSAL_ACTION_TYPE = "propose_task";

function map(r: any): AiProposal {
  const payload = (r.action_payload ?? {}) as ProposalPayload;
  return {
    id: r.id,
    tenantId: r.tenant_id,
    text: payload.title || r.suggestion_text,
    payload,
    entityType: r.entity_type,
    entityId: r.entity_id,
    priority: r.priority ?? 0,
    isNew: !r.shown_at,
    createdAt: r.created_at,
  };
}

export function useAiProposals() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  return useQuery({
    queryKey: ["ai-proposals", userId],
    enabled: !!userId,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async (): Promise<AiProposal[]> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("ai_proactive_suggestions")
        .select("*")
        .eq("action_type", PROPOSAL_ACTION_TYPE)
        .eq("dismissed", false)
        .eq("acted_on", false)
        .gt("expires_at", nowIso)
        .or(`target_user_id.eq.${userId},target_user_id.is.null`)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(map);
    },
  });
}

/** Conteo de propuestas pendientes para los badges de navegación. */
export function usePendingProposalsCount() {
  const { data } = useAiProposals();
  const list = data ?? [];
  return {
    total: list.length,
    unseen: list.filter((p) => p.isNew).length,
  };
}

/** Marca las propuestas como vistas (quita el estado "nuevas") al desplegar el panel. */
export function useMarkProposalsSeen() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase
        .from("ai_proactive_suggestions")
        .update({ shown_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-proposals", userId] }),
  });
}

export function useAcceptProposal() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  return useMutation({
    mutationFn: async (proposal: AiProposal) => {
      const p = proposal.payload;
      const { error: taskError } = await supabase.from("tasks").insert({
        tenant_id: proposal.tenantId,
        title: p.title || proposal.text,
        due_at: p.due_at ?? null,
        assignee_id: p.assignee_id ?? userId ?? null,
        contact_id: p.contact_id ?? (proposal.entityType === "contact" ? proposal.entityId : null),
        deal_id: p.deal_id ?? (proposal.entityType === "deal" ? proposal.entityId : null),
        task_kind: p.task_kind ?? "seguimiento",
        completed: false,
      } as any);
      if (taskError) throw taskError;

      const { error } = await supabase
        .from("ai_proactive_suggestions")
        .update({ acted_on: true, dismissed: true })
        .eq("id", proposal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-proposals", userId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["mi-dia"] });
      qc.invalidateQueries({ queryKey: ["contact-tasks"] });
    },
  });
}

export function useRejectProposal() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  return useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase
        .from("ai_proactive_suggestions")
        .update({ dismissed: true })
        .eq("id", proposalId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-proposals", userId] }),
  });
}
