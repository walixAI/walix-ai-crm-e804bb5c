import { useMemo, useState } from "react";
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
import CallAnalysisDialog from "@/components/calls/CallAnalysisDialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { isEffectiveCall } from "@/lib/activities/consolidateCalls";
import { isMissedInbound } from "@/lib/activities/inboundCalls";
import { readAllPages } from "@/lib/queries/paginate";
import { IncomingPhonePreference } from "@/components/calls/IncomingPhonePreference";

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
  const [view, setView] = useState("historial");
  const [analysisCall, setAnalysisCall] = useState<any | null>(null);

  const { data: calls, isLoading } = useQuery({
    queryKey: ["calls", activeTenantId],
    enabled: !!activeTenantId,
    refetchInterval: analysisCall ? 2500 : 15000,
    queryFn: async () => {
      if (!activeTenantId) return [];
      const rows = await readAllPages((from, to) => supabase
        .from("calls")
        .select("id, direction, status, to_number, from_number, duration_seconds, answered_at, user_id, outcome, notes, created_at, contact_id, deal_id, transcript, ai_summary, ai_suggestions, contacts(name)")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to));
      const ids = [...new Set(rows.flatMap((c) => c.user_id ? [c.user_id] : []))];
      const names = new Map<string, string | null>();
      for (let start = 0; start < ids.length; start += 100) {
        const { data, error } = await supabase.from("profiles").select("id,full_name").in("id", ids.slice(start, start + 100));
        if (error) throw error;
        data?.forEach((p) => names.set(p.id, p.full_name));
      }
      return rows.map((c) => ({ ...c, advisorName: c.user_id ? names.get(c.user_id) ?? "Asesor asignado" : "Sin asesor · supervisión" }));
    },
  });

  const filtered = (calls ?? []).filter((c: any) => {
    if (view === "perdidas" && !isMissedInbound(c)) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      c.to_number?.toLowerCase().includes(s) ||
      c.from_number?.toLowerCase().includes(s) ||
      c.contacts?.name?.toLowerCase().includes(s) ||
      c.outcome?.toLowerCase().includes(s)
    );
  });

  /** Intentos y llamadas efectivas del historial visible. */
  const metrics = useMemo(() => {
    const rows = calls ?? [];
    const effective = rows.filter((c: any) => isEffectiveCall(
      { status: c.status, duration: c.duration_seconds },
      c.ai_summary ?? "",
    )).length;
    const attempts = rows.length - effective;
    return {
      total: rows.length,
      effective,
      attempts,
      rate: rows.length ? Math.round((effective / rows.length) * 100) : 0,
      perEffective: effective ? (attempts / effective).toFixed(1) : "—",
    };
  }, [calls]);

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

      <IncomingPhonePreference />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Intentos", value: metrics.attempts, hint: "Llamadas que no llegaron a una conversación" },
          { label: "Llamadas efectivas", value: metrics.effective, hint: "Contestaron y hubo duración" },
          { label: "Tasa de conexión", value: `${metrics.rate}%`, hint: "Efectivas sobre todas las llamadas" },
          { label: "Intentos hasta conectar", value: metrics.perEffective, hint: "Promedio de intentos por cada llamada efectiva" },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-3" title={m.hint}>
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="text-xl font-semibold tabular-nums">{m.value}</div>
          </div>
        ))}
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="perdidas">Entrantes no atendidas ({(calls ?? []).filter(isMissedInbound).length})</TabsTrigger>
          <TabsTrigger value="campanas">Campañas</TabsTrigger>
        </TabsList>
        <TabsContent value={view === "perdidas" ? "perdidas" : "historial"} className="mt-4">
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Phone className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>{view === "perdidas" ? "No hay llamadas entrantes sin atender." : "No hay llamadas que coincidan."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c: any) => {
            const st = STATUS_LABEL[c.status] ?? { label: c.status, variant: "outline" as const };
            const eff = isEffectiveCall({ status: c.status, duration: c.duration_seconds }, c.ai_summary ?? "");
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
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
                      <span className="font-medium truncate">{c.direction === "inbound" ? c.from_number : c.to_number}</span>
                    )}
                    <Badge variant={st.variant}>{st.label}</Badge>
                    {isMissedInbound(c) && <Badge variant="destructive">Entrante no atendida</Badge>}
                    <Badge variant={eff ? "default" : "secondary"}>{eff ? "Llamada efectiva" : "Intento"}</Badge>
                    {c.outcome && <span className="text-xs text-muted-foreground">{c.outcome}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1 flex-wrap">
                    <span>{c.direction === "inbound" ? c.from_number : c.to_number}</span>
                    {c.duration_seconds != null && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s</span>
                    )}
                    <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: es })}</span>
                    <span>{new Date(c.created_at).toLocaleString("es-MX")}</span>
                    {c.direction === "inbound" && <span>Responsable: {c.advisorName}</span>}
                  </div>
                  {c.notes && <p className="text-sm text-muted-foreground mt-1 truncate">{c.notes}</p>}
                  {c.ai_summary && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.ai_summary}</p>}
                </div>
                <Button size="sm" variant={c.ai_summary ? "secondary" : "outline"} className="shrink-0" onClick={() => setAnalysisCall(c)}>
                  <Sparkles className="h-4 w-4 mr-1" />{c.ai_summary ? "Ver análisis" : "Analizar"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
          <CallAnalysisDialog call={calls?.find((c) => c.id === analysisCall?.id) ?? analysisCall} onClose={() => setAnalysisCall(null)} />
        </TabsContent>
        <TabsContent value="campanas" className="mt-4">
          <CallCampaignsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
