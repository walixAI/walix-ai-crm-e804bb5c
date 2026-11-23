import { isInternalTestEmail } from "@/lib/internalUsers";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAgentReasons, useAgentStatus } from "@/hooks/useAgentStatus";
import { readAllPages } from "@/lib/queries/paginate";
import { resolvePeriodRange } from "@/lib/queries/reports";
import type { PeriodValue } from "@/lib/reports/filters";
import { buildAgentSummary, buildAgentStatusCSV, fmtTime, minutesBetween, type AgentStatusLogRow } from "@/lib/reports/agentStatusReport";
import { downloadCSV } from "@/lib/reports/exportCsv";
import { PeriodPicker } from "@/components/reports/PeriodPicker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { kindDot, elapsed } from "./AgentStatusSelector";
import { toastError } from "@/lib/toast";

const CAUSE: Record<string, string> = { manual: "El asesor", logout: "Cerró sesión", supervisor: "Supervisor", inactividad: "Sin conexión", reconexion: "Reconectó" };

export function AgentStatusTab({ period, onPeriodChange }: { period: PeriodValue; onPeriodChange?: (p: PeriodValue) => void }) {
  const { activeTenantId, roles } = useAuth();
  const isSup = roles.some((r) => ["tenant_owner", "tenant_admin", "sales_manager", "super_admin", "platform_owner", "platform_staff"].includes(r));
  const { data: reasons = [] } = useAgentReasons();
  const { change } = useAgentStatus();
  const [who, setWho] = useState("all");
  const [kind, setKind] = useState("all");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const team = useQuery({
    queryKey: ["agent-team", activeTenantId], enabled: !!activeTenantId, refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("agent_status_current").select("user_id,reason_id,kind,reason_name,since,last_seen_at").eq("tenant_id", activeTenantId!);
      if (error) throw error;
      return data ?? [];
    },
  });
  const members = useQuery({
    queryKey: ["agent-team-members", activeTenantId], enabled: !!activeTenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,email").eq("tenant_id", activeTenantId!).order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const hiddenIds = useMemo(() => new Set((members.data ?? []).filter((m) => isInternalTestEmail(m.email)).map((m) => m.id)), [members.data]);
  const liveRows = useMemo(() => {
    const byUser = new Map((team.data ?? []).map((t) => [t.user_id, t]));
    return (members.data ?? []).filter((m) => !hiddenIds.has(m.id)).map((m) => ({ member: m, status: byUser.get(m.id) ?? null }));
  }, [team.data, members.data, hiddenIds]);
  const log = useQuery({
    queryKey: ["agent-log", activeTenantId, period.preset, period.from ?? null, period.to ?? null], enabled: !!activeTenantId, refetchInterval: 30_000,
    queryFn: async () => {
      const { from, to } = resolvePeriodRange(period);
      const rows = await readAllPages((a, b) => supabase.from("agent_status_log")
        .select("id,user_id,kind,reason_name,started_at,ended_at,set_by,ended_by,end_cause")
        .eq("tenant_id", activeTenantId!).lte("started_at", to.toISOString())
        .or(`ended_at.is.null,ended_at.gte.${from.toISOString()}`)
        .order("started_at", { ascending: false }).order("id").range(a, b));
      return { rows: rows as AgentStatusLogRow[], from, to };
    },
  });
  const ids = useMemo(() => [...new Set([...(team.data ?? []).map((t) => t.user_id), ...(log.data?.rows ?? []).flatMap((r) => [r.user_id, r.set_by ?? ""]).filter(Boolean)])], [team.data, log.data]);
  const names = useQuery({
    queryKey: ["agent-names", activeTenantId, ids.join(",")], enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name").in("id", ids.slice(0, 300));
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.id, p.full_name ?? "Usuario"]));
    },
  });
  const nm = names.data ?? new Map<string, string>();
  const rows = (log.data?.rows ?? []).filter((r) => !hiddenIds.has(r.user_id) && (who === "all" || r.user_id === who) && (kind === "all" || r.kind === kind));
  const maxBy = Object.fromEntries(reasons.map((r) => [r.name, r.max_minutes]));
  const summary = log.data ? buildAgentSummary(rows, log.data, maxBy, now) : [];
  const stale = (t: any) => t.kind === "available" && now - Date.parse(t.last_seen_at) > 180_000;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border font-semibold text-sm">Equipo en vivo</div>
        {team.isLoading || members.isLoading ? <Skeleton className="h-24 m-4" /> : !liveRows.length ? (
          <p className="p-4 text-sm text-muted-foreground">No hay miembros en esta empresa todavía.</p>
        ) : (
          <div className="divide-y divide-border">
            {liveRows.map(({ member, status: t }) => (
              <div key={member.id} className="flex items-center gap-3 px-4 py-2.5 text-sm flex-wrap">
                <span className={cn("h-2.5 w-2.5 rounded-full", kindDot(!t || stale(t) ? "offline" : t.kind))} />
                <span className="font-medium min-w-[140px]">{member.full_name ?? "Usuario"}</span>
                <span className="flex-1">{!t ? "Nunca se ha conectado" : stale(t) ? "Sin conexión" : t.kind === "pause" ? `Pausa: ${t.reason_name}` : t.reason_name}</span>
                <span className="tabular-nums text-muted-foreground">{t ? `desde ${fmtTime(t.since)} · ${elapsed(t.since, now)}` : "—"}</span>
                {isSup && (
                  <Select value={t?.reason_id ?? undefined} onValueChange={(v) => change.mutate({ reasonId: v, userId: member.id }, { onError: (e: any) => toastError("No se pudo cambiar", e.message) })}>
                    <SelectTrigger className="h-8 w-[170px]"><SelectValue placeholder="Cambiar" /></SelectTrigger>
                    <SelectContent>{reasons.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 flex-wrap">
        {onPeriodChange && <PeriodPicker value={period} onChange={onPeriodChange} />}
        <Select value={who} onValueChange={setWho}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos los asesores</SelectItem>{[...new Set((log.data?.rows ?? []).map((r) => r.user_id).filter((id) => !hiddenIds.has(id)))].map((id) => <SelectItem key={id} value={id}>{nm.get(id) ?? "Usuario"}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem><SelectItem value="available">Disponible</SelectItem>
            <SelectItem value="pause">Pausas</SelectItem><SelectItem value="offline">Desconexiones</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={!rows.length} onClick={() => downloadCSV(`estados-asesores-${new Date().toISOString().slice(0, 10)}.csv`, buildAgentStatusCSV(rows, summary, nm, now))}>
          <Download className="mr-1.5 h-4 w-4" /> Exportar estados
        </Button>
      </div>

      <section className="rounded-xl border border-border bg-card overflow-x-auto">
        <div className="px-4 py-3 border-b border-border font-semibold text-sm">Resumen por asesor</div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr className="text-left">
            {["Asesor", "Primera conexión", "Última desconexión", "Disponible", "En pausa", "% disponible", "Pausas excedidas", "Detalle"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
          </tr></thead>
          <tbody>{summary.map((s) => (
            <tr key={s.user_id} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{nm.get(s.user_id) ?? "Usuario"}</td>
              <td className="px-3 py-2">{fmtTime(s.firstConnection)}</td>
              <td className="px-3 py-2">{s.lastDisconnection ? fmtTime(s.lastDisconnection) : "—"}</td>
              <td className="px-3 py-2 tabular-nums">{s.availableMin} min</td>
              <td className="px-3 py-2 tabular-nums">{s.pauseMin} min</td>
              <td className="px-3 py-2 tabular-nums">{s.occupancy}%</td>
              <td className="px-3 py-2 tabular-nums">{s.exceeded}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{Object.entries(s.byReason).map(([k, v]) => `${k} ${v} min`).join(" · ") || "—"}</td>
            </tr>))}</tbody>
        </table>
        {!summary.length && <p className="p-4 text-sm text-muted-foreground">Sin cambios de estado en este periodo.</p>}
      </section>

      <section className="rounded-xl border border-border bg-card overflow-x-auto">
        <div className="px-4 py-3 border-b border-border font-semibold text-sm">Bitácora de cambios</div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr className="text-left">
            {["Asesor", "Estado", "Inicio", "Fin", "Duración", "Cambió", "Cierre"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
          </tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{nm.get(r.user_id) ?? "Usuario"}</td>
              <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", kindDot(r.kind))} />{r.kind === "pause" ? `Pausa: ${r.reason_name}` : r.reason_name}</span></td>
              <td className="px-3 py-2">{fmtTime(r.started_at)}</td>
              <td className="px-3 py-2">{fmtTime(r.ended_at)}</td>
              <td className="px-3 py-2 tabular-nums">{minutesBetween(r.started_at, r.ended_at, now)} min</td>
              <td className="px-3 py-2">{r.set_by ? nm.get(r.set_by) ?? "Usuario" : "Sistema"}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{r.end_cause ? CAUSE[r.end_cause] ?? r.end_cause : ""}</td>
            </tr>))}</tbody>
        </table>
        {log.isLoading && <Skeleton className="h-20 m-4" />}
      </section>
    </div>
  );
}
