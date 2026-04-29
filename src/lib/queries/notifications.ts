import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantId } from "@/lib/queries/tenant";

export type NotificationCategory = "operational" | "ai" | "system";
export type NotificationSeverity = "info" | "success" | "warning" | "danger";

export interface NotificationRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  category: NotificationCategory;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  icon: string | null;
  severity: NotificationSeverity;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
}

const KEY = (tenantId?: string | null, userId?: string | null) =>
  ["notifications", tenantId, userId] as const;

export function useNotifications(limit = 30) {
  const { user } = useAuth();
  const { data: tenantId } = useTenantId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY(tenantId, user?.id),
    enabled: !!tenantId && !!user?.id,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("tenant_id", tenantId!)
        .or(`user_id.is.null,user_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`notifications:${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `tenant_id=eq.${tenantId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", tenantId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, qc]);

  return query;
}

export function useUnreadCount() {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.read_at).length;
}

export function useMarkRead() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", tenantId] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async () => {
      if (!tenantId || !user?.id) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .is("read_at", null)
        .or(`user_id.is.null,user_id.eq.${user.id}`);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", tenantId] }),
  });
}
