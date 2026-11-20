import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PhoneIncoming, X, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Personal alerts also cover unassigned callers routed to supervision. */
export function IncomingCallPopup() {
  const userId = useAuthStore((s) => s.user?.id);
  const tenantId = useAuthStore((s) => s.activeTenantId);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const key = ["incoming-call", tenantId, userId];

  const { data: call } = useQuery({
    queryKey: key,
    enabled: !!userId && !!tenantId,
    refetchInterval: 5000,
    queryFn: async () => {
      if (!tenantId || !userId) return null;
      const { data, error } = await supabase.from("notifications")
        .select("id,title,body,type,data")
        .eq("tenant_id", tenantId).eq("user_id", userId)
        .in("type", ["inbound_call", "missed_inbound_call"]).is("read_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`incoming-calls-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tenantId]);

  if (!call) return null;
  const act = async (openReport: boolean) => {
    setBusy(true);
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", call.id).eq("tenant_id", tenantId ?? "").eq("user_id", userId ?? "");
    setBusy(false);
    if (error) { toast.error("No se pudo cerrar el aviso"); return; }
    await qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    if (openReport) navigate("/llamadas");
  };

  return (
    <div role="status" className="fixed bottom-4 right-4 z-[60] w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-primary/40 bg-card p-4 shadow-xl animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-success/15 flex items-center justify-center animate-pulse">
          <PhoneIncoming className="h-5 w-5 text-success" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold break-words">{call.title}</p>
          <p className="text-xs text-muted-foreground break-words">{call.body}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={busy} onClick={() => act(false)}>
          <X className="h-4 w-4 mr-1" /> Cerrar aviso
        </Button>
        <Button disabled={busy} onClick={() => act(true)}>
          <ArrowUpRight className="h-4 w-4 mr-1" /> Ver llamadas
        </Button>
      </div>
    </div>
  );
}
