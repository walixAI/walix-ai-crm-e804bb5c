import { supabase } from "@/integrations/supabase/client";

export async function logAudit(params: {
  action: string;
  tenantId: string | null;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    actor_email: user.email ?? null,
    tenant_id: params.tenantId,
    action: params.action,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    metadata: (params.metadata as never) ?? null,
  });
}

export interface AuditEntry {
  id: string;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  tenant_id: string | null;
}

export async function fetchAuditLog(tenantId: string, limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as AuditEntry[];
}