import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchInvitations,
  fetchMembers,
  setMemberActive,
  createInvitation,
  revokeInvitation,
} from "@/services/tenant";
import { logAudit } from "@/services/audit";
import type { Role } from "@/store/auth";
import { supabase } from "@/integrations/supabase/client";

const ROLE_LABELS: Record<string, string> = {
  tenant_owner: "Propietario",
  tenant_admin: "Administrador",
  sales_manager: "Gerente de ventas",
  sales_rep: "Vendedor",
};

async function sendInviteEmail(inv: { id: string; token?: string }) {
  try {
    if (!inv?.id || !inv.token) return;
    await supabase.functions.invoke("send-team-invite", { body: { invitationId: inv.id } });
  } catch (e) {
    console.error("No se pudo enviar el correo de invitación", e);
  }
}

export function useMembers(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["members", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchMembers(tenantId!),
    staleTime: 30_000,
  });
}

export function useInvitations(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["invitations", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchInvitations(tenantId!),
    staleTime: 30_000,
  });
}

export function useToggleMemberActive(tenantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      await setMemberActive(userId, active);
      await logAudit({
        action: active ? "team.member.activated" : "team.member.deactivated",
        tenantId,
        targetType: "user",
        targetId: userId,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", tenantId] }),
  });
}

export function useCreateInvitation(tenantId: string | null, invitedBy: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: Role }) => {
      if (!tenantId || !invitedBy) throw new Error("Missing tenant or user");
      const inv = await createInvitation({ tenantId, email, role, invitedBy });
      await sendInviteEmail(inv as any);
      await logAudit({
        action: "team.invite.sent",
        tenantId,
        targetType: "invitation",
        targetId: inv.id,
        metadata: { email, role },
      });
      return inv;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations", tenantId] }),
  });
}

export function useRevokeInvitation(tenantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await revokeInvitation(id);
      await logAudit({
        action: "team.invite.revoked",
        tenantId,
        targetType: "invitation",
        targetId: id,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations", tenantId] }),
  });
}