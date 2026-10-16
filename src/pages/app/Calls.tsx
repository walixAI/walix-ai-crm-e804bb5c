import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Phone, PhoneIncoming, PhoneOutgoing, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CallCampaignsTab from "@/components/calls/CallCampaignsTab";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  queued: { label: "En cola", variant: "outline" },
  ringing: { label: "Sonando", variant: "outline" },
  answered: { label: "En curso", variant: "default" },
  completed: { label: "Completada", variant: "default" },
  no_answer: { label: "Sin respuesta", variant: "secondary" },
  busy: { label: "Ocupado", variant: "secondary" },
  voicemail: { label: "Buzón", variant: "secondary" },
  failed: { label: "Fallida", variant: "destructive" },
};

export default function Calls() {
  const { activeTenantId } = useAuth();
  const [q, setQ] = useState("");

  const { data: calls, isLoading } = useQuery({
    queryKey: ["calls", activeTenantId],
    enabled: !!activeTenantId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("id, direction, status, to_number, from_number, duration_seconds, outcome, notes, created_at, contact_id, contacts(name)")
        .eq("tenant_id", activeTenantId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (calls ?? []).filter((c: any) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      c.to_number?.toLowerCase().includes(s) ||
      c.contacts?.name?.toLowerCase().includes(s) ||
      c.outcome?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" /> Llamadas
          </h1>
          <p className="text-sm text-muted-foreground">Historial de llamadas de tu equipo</p>
        </div>
        <Input
          placeholder="Buscar por número, contacto o resultado…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Phone className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Aún no hay llamadas registradas.</p>
          <p className="text-sm">Usa el botón «Llamar» en cualquier contacto para empezar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c: any) => {
            const st = STATUS_LABEL[c.status] ?? { label: c.status, variant: "outline" as const };
            return (
              <div key={c.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                <div className="shrink-0">
                  {c.direction === "inbound"
                    ? <PhoneIncoming className="h-5 w-5 text-accent" />
                    : <PhoneOutgoing className="h-5 w-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.contact_id ? (
                      <Link to={`/contacts/${c.contact_id}`} className="font-medium hover:underline truncate">
                        {c.contacts?.name ?? "Contacto"}
                      </Link>
                    ) : (
                      <span className="font-medium truncate">{c.to_number}</span>
                    )}
                    <Badge variant={st.variant}>{st.label}</Badge>
                    {c.outcome && <span className="text-xs text-muted-foreground">{c.outcome}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1 flex-wrap">
                    <span>{c.direction === "inbound" ? c.from_number : c.to_number}</span>
                    {c.duration_seconds != null && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s</span>
                    )}
                    <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: es })}</span>
                  </div>
                  {c.notes && <p className="text-sm text-muted-foreground mt-1 truncate">{c.notes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
