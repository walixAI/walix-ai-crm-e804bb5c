import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CallCampaignsTab from "@/components/calls/CallCampaignsTab";
import CallAnalysisDialog from "@/components/calls/CallAnalysisDialog";
import { CallsByAdvisorTable } from "@/components/calls/CallsByAdvisorTable";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { isEffectiveCall } from "@/lib/activities/consolidateCalls";
import { isMissedInbound } from "@/lib/activities/inboundCalls";
import { readAllPages } from "@/lib/queries/paginate";
import { resolvePeriodRange } from "@/lib/queries/reports";
import { buildCallsReport, buildCallsReportCSV, type CallsReportRow } from "@/lib/reports/callsReport";
import { downloadCSV } from "@/lib/reports/exportCsv";
import { PeriodPicker } from "@/components/reports/PeriodPicker";
import { periodLabel, type PeriodValue } from "@/lib/reports/filters";
import { useTenant } from "@/lib/queries/tenant";
import { AgentStatusTab } from "@/components/agent-status/AgentStatusTab";
import { isRecordingDownloadable } from "../../../supabase/functions/_shared/call-recording";
import { CallRecordingButton } from "@/components/calls/CallRecordingButton";
import { IncomingPhonePreference } from "@/components/calls/IncomingPhonePreference";
import { CallHangupDetails } from "@/components/calls/CallHangupDetails";

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
  const { data: tenant } = useTenant();
  const [q, setQ] = useState("");
  const [view, setView] = useState("historial");
  const [analysisCall, setAnalysisCall] = useState<any | null>(null);
  const [period, setPeriod] = useState<PeriodValue>({ preset: "month" });
  const [sortKey, setSortKey] = useState<"outboundTotal" | "outboundEffective" | "outboundRate" | "inboundReceived" | "inboundMissed">("outboundTotal");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: calls, isLoading } = useQuery({
    queryKey: ["calls", activeTenantId, period.preset, period.from ?? null, period.to ?? null],
    enabled: !!activeTenantId,
    refetchInterval: analysisCall ? 2500 : 15000,
    queryFn: async () => {
      if (!activeTenantId) return [];
      // Las fechas relativas se resuelven dentro de la consulta, no antes de reintentar.
      const { from, to } = resolvePeriodRange(period);
      const rows = await readAllPages((pageFrom, pageTo) => supabase
        .from("calls")
        .select("id, direction, status, to_number, from_number, duration_seconds, answered_at, ended_at, hangup_by, hangup_at, recording_url, user_id, outcome, notes, created_at, contact_id, deal_id, transcript, ai_summary, ai_suggestions, contacts(name)")
        .eq("tenant_id", activeTenantId)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageFrom, pageTo));
      const ids = [...new Set(rows.flatMap((c) => c.user_id ? [c.user_id] : []))];
      const names = new Map<string, string | null>();
      for (let start = 0; start < ids.length; start += 100) {
        const { data, error } = await supabase.from("profiles").select("id,full_name").in("id", ids.slice(start, start + 100));
        if (error) throw error;
        data?.forEach((p) => names.set(p.id, p.full_name));
      }
      return rows.map((c) => ({ ...c, advisorName: c.user_id ? names.get(c.user_id) ?? "Asesor asignado" : "Grupo de recepción · sin asignar" }));
    },
  });

  const rows = (calls ?? []) as CallsReportRow[];
  const report = useMemo(() => buildCallsReport(rows), [calls]);

  const missed = rows.filter((c) => isMissedInbound(c));

  const filtered = rows.filter((c) => {
    if (view === "perdidas" && !isMissedInbound(c)) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      c.to_number?.toLowerCase().includes(s) ||
      c.from_number?.toLowerCase().includes(s) ||
      (c as any).contacts?.name?.toLowerCase().includes(s) ||
      c.outcome?.toLowerCase().includes(s)
    );
  });

  const exportCSV = () => {
    const name = `llamadas-${period.preset}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(name, buildCallsReportCSV(report, rows, { periodLabel: periodLabel(period), tenantName: tenant?.name ?? null }));
  };

  return (
    <div className="p-6 max-w-full space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" /> Llamadas
          </h1>
          <p className="text-sm text-muted-foreground">Historial y desempeño de llamadas de tu equipo</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodPicker value={period} onChange={setPeriod} />
          <Button size="sm" variant="outline" onClick={exportCSV} disabled={rows.length === 0}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <Input
        placeholder="Buscar por número, contacto o resultado…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full"
      />

      <IncomingPhonePreference />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <PhoneOutgoing className="h-3.5 w-3.5" /> Llamadas salientes
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Marcadas", value: report.outbound.total, hint: "Llamadas iniciadas desde Walix" },
              { label: "Efectivas", value: report.outbound.effective, hint: "Contestaron y hubo conversación" },
              { label: "Tasa de conexión", value: `${report.outbound.rate}%`, hint: "Efectivas sobre todas las marcadas" },
              { label: "Intentos hasta conectar", value: report.outbound.perEffective, hint: "Promedio de intentos por cada llamada efectiva" },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-border bg-background/40 p-2.5" title={m.hint}>
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className="text-xl font-semibold tabular-nums">{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <PhoneIncoming className="h-3.5 w-3.5" /> Llamadas entrantes
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Recibidas", value: report.inbound.received, hint: "Llamadas que llegaron al número" },
              { label: "Atendidas", value: report.inbound.answered, hint: "Un asesor contestó" },
              { label: "No atendidas", value: report.inbound.missed, hint: "Nadie contestó: quedan en su pestaña" },
              { label: "Tasa de atención", value: `${report.inbound.attentionRate}%`, hint: "Atendidas sobre las recibidas" },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-border bg-background/40 p-2.5" title={m.hint}>
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className="text-xl font-semibold tabular-nums">{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="perdidas">Entrantes no atendidas ({missed.length})</TabsTrigger>
          <TabsTrigger value="responsables">Por responsable</TabsTrigger>
          <TabsTrigger value="estados">Estados del equipo</TabsTrigger>
          <TabsTrigger value="campanas">Campañas</TabsTrigger>
        </TabsList>

        <TabsContent value="historial" className="mt-4">
          <CallHistoryList rows={filtered} isLoading={isLoading} onAnalyze={setAnalysisCall} />
        </TabsContent>

        <TabsContent value="perdidas" className="mt-4">
          <CallHistoryList rows={filtered} isLoading={isLoading} onAnalyze={setAnalysisCall} missedOnly />
        </TabsContent>

        <TabsContent value="responsables" className="mt-4">
          <CallsByAdvisorTable
            rows={report.byAdvisor}
            isLoading={isLoading}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={(k) => {
              if (k === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
              else { setSortKey(k); setSortDir("desc"); }
            }}
          />
        </TabsContent>

        <TabsContent value="estados" className="mt-4">
          <AgentStatusTab period={period} onPeriodChange={setPeriod} />
        </TabsContent>

        <TabsContent value="campanas" className="mt-4">
          <CallCampaignsTab />
        </TabsContent>
      </Tabs>

      <CallAnalysisDialog call={calls?.find((c) => c.id === analysisCall?.id) ?? analysisCall} onClose={() => setAnalysisCall(null)} />
    </div>
  );
}

function CallHistoryList({ rows, isLoading, onAnalyze, missedOnly = false }: {
  rows: CallsReportRow[];
  isLoading: boolean;
  onAnalyze: (call: any) => void;
  missedOnly?: boolean;
}) {
  if (isLoading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Phone className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p>{missedOnly ? "No hay llamadas entrantes sin atender en este periodo." : "No hay llamadas que coincidan."}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((c) => {
        const st = STATUS_LABEL[c.status] ?? { label: c.status, variant: "outline" as const };
        const eff = isEffectiveCall({ status: c.status, duration: c.duration_seconds }, c.ai_summary ?? "");
        const contact = (c as any).contacts as { name?: string } | undefined;
        return (
          <div key={c.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
            <div className="shrink-0">
              {c.direction === "inbound"
                ? <PhoneIncoming className="h-5 w-5 text-accent" />
                : <PhoneOutgoing className="h-5 w-5 text-primary" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {c.contact_id ? (
                  <Link to={`/contacts/${c.contact_id}`} className="truncate font-medium hover:underline">
                    {contact?.name ?? "Contacto"}
                  </Link>
                ) : (
                  <span className="truncate font-medium">{c.direction === "inbound" ? c.from_number : c.to_number}</span>
                )}
                <Badge variant={st.variant}>{st.label}</Badge>
                {isMissedInbound(c) && <Badge variant="destructive">Entrante no atendida</Badge>}
                <Badge variant={eff ? "default" : "secondary"}>{eff ? "Llamada efectiva" : "Intento"}</Badge>
                {c.outcome && <span className="text-xs text-muted-foreground">{c.outcome}</span>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{c.direction === "inbound" ? c.from_number : c.to_number}</span>
                {c.duration_seconds != null && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s</span>
                )}
                <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: es })}</span>
                <span>{new Date(c.created_at).toLocaleString("es-MX")}</span>
                {c.direction === "inbound" && <span>Responsable: {c.advisorName ?? "Grupo de recepción · sin asignar"}</span>}
              </div>
              {(c.ended_at || ["completed", "failed", "no_answer", "busy", "voicemail"].includes(c.status)) && <div className="mt-1"><CallHangupDetails hangup_by={c.hangup_by} hangup_at={c.hangup_at} userId={c.user_id} /></div>}
              {(c as any).notes && <p className="mt-1 truncate text-sm text-muted-foreground">{(c as any).notes}</p>}
              {c.ai_summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.ai_summary}</p>}
            </div>
            {isRecordingDownloadable(c as any) && <div className="shrink-0"><CallRecordingButton callId={c.id} size="icon" /></div>}
            <Button size="sm" variant={c.ai_summary ? "secondary" : "outline"} className="shrink-0" onClick={() => onAnalyze(c)}>
              <Sparkles className="mr-1 h-4 w-4" />{c.ai_summary ? "Ver análisis" : "Analizar"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
