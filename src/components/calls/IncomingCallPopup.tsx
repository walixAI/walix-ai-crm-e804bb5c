import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, PhoneOff, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Aviso emergente cuando suena una llamada entrante asignada al usuario. */
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
      const since = new Date(Date.now() - 2 * 60_000).toISOString();
      const { data } = await supabase.from("calls")
        .select("id, from_number, contact_id, metadata, contacts:contact_id(name)")
        .eq("tenant_id", tenantId!).eq("user_id", userId!).eq("direction", "inbound")
        .eq("status", "ringing").gte("created_at", since)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data as any;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`incoming-calls-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tenantId]);

  if (!call) return null;
  const name = call.contacts?.name ?? "Número desconocido";
  const option = call.metadata?.pbx?.option;

  const act = async (action: "answer" | "decline") => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("telephony-api", { body: { action, call_id: call.id } });
    setBusy(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? "No se pudo responder"); return; }
    qc.invalidateQueries({ queryKey: key });
    if (action === "answer") {
      toast.success("Llamada contestada. Registra el resultado al terminar.");
      navigate(call.contact_id ? `/contacts/${call.contact_id}` : "/llamadas");
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-80 rounded-2xl border border-primary/40 bg-card p-4 shadow-xl animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-success/15 flex items-center justify-center animate-pulse">
          <Phone className="h-5 w-5 text-success" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Llamada entrante{option ? ` · ${option}` : ""}</p>
          <p className="font-semibold truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{call.from_number}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={busy} onClick={() => act("decline")}>
          <PhoneOff className="h-4 w-4 mr-1" /> Rechazar
        </Button>
        <Button className="bg-success text-success-foreground hover:bg-success/90" disabled={busy} onClick={() => act("answer")}>
          <Phone className="h-4 w-4 mr-1" /> Contestar
        </Button>
      </div>
      {call.contact_id && (
        <button className="mt-2 w-full text-xs text-primary flex items-center justify-center gap-1 hover:underline"
          onClick={() => navigate(`/contacts/${call.contact_id}`)}>
          <UserRound className="h-3 w-3" /> Ver contacto
        </button>
      )}
    </div>
  );
}
