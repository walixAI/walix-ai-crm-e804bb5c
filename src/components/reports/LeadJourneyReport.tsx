import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Route } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { useTenantUsers } from "@/lib/queries/tenantUsers";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeadSourceBadge, leadOriginLabel, LEAD_ORIGINS } from "@/components/walix/LeadSourceBadge";
import { downloadCSV } from "@/lib/reports/exportCsv";

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—");
const days = (a: string, b?: string | null) => Math.max(0, Math.round(((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / 86400000));

/** Score 0-100: avance en el embudo (50), seguimiento (20), recencia (15) y datos completos (15). */
function leadScore(i: { stagePos: number; isWon: boolean; isLost: boolean; activities: number; lastActivityAt: string | null; hasPhone: boolean; hasEmail: boolean; hasAttribution: boolean }) {
  if (i.isWon) return 100;
  if (i.isLost) return 0;
  const since = i.lastActivityAt ? (Date.now() - new Date(i.lastActivityAt).getTime()) / 86400000 : Infinity;
  const recency = since <= 3 ? 15 : since <= 7 ? 10 : since <= 14 ? 5 : 0;
  return Math.round(i.stagePos * 50 + Math.min(i.activities, 5) * 4 + recency + (i.hasPhone ? 5 : 0) + (i.hasEmail ? 5 : 0) + (i.hasAttribution ? 5 : 0));
}
const scoreClass = (n: number) => n >= 70 ? "bg-success/15 text-success" : n >= 40 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground";

const PERIODS: Record<string, number> = { "7": 7, "30": 30, "90": 90, "365": 365 };

export function LeadJourneyReport() {
  const { data: tenantId } = useTenantId();
  const { data: users = [] } = useTenantUsers();
  const [period, setPeriod] = useState("30");
  const [origin, setOrigin] = useState("all");
  const [campaign, setCampaign] = useState("all");
  const [owner, setOwner] = useState("all");
  const [stage, setStage] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["lead-journey", tenantId, period],
    enabled: !!tenantId,
    queryFn: async () => {
      const since = new Date(Date.now() - PERIODS[period] * 86400000).toISOString();
      const { data: deals, error } = await supabase.from("deals")
        .select("id, name, contact_id, owner_id, stage_id, stage_name, source, is_won, is_lost, created_at, won_at, contacts(name, source, phone, email)")
        .eq("tenant_id", tenantId!).gte("created_at", since).order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      const ids = (deals ?? []).map((d) => d.id);
      const cids = (deals ?? []).map((d) => d.contact_id).filter(Boolean) as string[];
      const [hist, attr, acts, stages] = await Promise.all([
        ids.length ? supabase.from("deal_stage_history").select("deal_id, to_stage_id, to_stage_name, changed_at").in("deal_id", ids).order("changed_at") : { data: [] as any[] },
        cids.length ? supabase.from("contact_attribution").select("*").in("contact_id", cids).eq("touch_type", "first") : { data: [] as any[] },
        ids.length ? supabase.from("activities").select("deal_id, type, occurred_at, metadata").in("deal_id", ids).order("occurred_at", { ascending: false }) : { data: [] as any[] },
        supabase.from("pipeline_stages").select("id, name, position, pipeline_id, is_won, is_lost").eq("tenant_id", tenantId!).order("position"),
      ]);
      return { deals: deals ?? [], hist: hist.data ?? [], attr: attr.data ?? [], acts: acts.data ?? [], stages: stages.data ?? [] };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const attrBy = new Map(data.attr.map((a: any) => [a.contact_id, a]));
    return data.deals.map((d: any) => {
      const a: any = attrBy.get(d.contact_id);
      const h = data.hist.filter((x: any) => x.deal_id === d.id);
      const stageDates: Record<string, string> = {};
      h.forEach((x: any) => { if (x.to_stage_name && !stageDates[x.to_stage_name]) stageDates[x.to_stage_name] = x.changed_at; });
      // La primera etapa del embudo se alcanza al crearse el lead.
      const st = data.stages.find((x: any) => x.id === d.stage_id);
      const pipeStages = data.stages.filter((x: any) => x.pipeline_id === st?.pipeline_id && !x.is_lost);
      if (pipeStages[0] && !stageDates[pipeStages[0].name]) stageDates[pipeStages[0].name] = d.created_at;
      const dealActs = data.acts.filter((x: any) => x.deal_id === d.id);
      const score = leadScore({
        stagePos: st && pipeStages.length > 1 ? Math.max(0, pipeStages.findIndex((x: any) => x.id === st.id)) / (pipeStages.length - 1) : 0,
        isWon: d.is_won, isLost: d.is_lost, activities: dealActs.length,
        lastActivityAt: dealActs[0]?.occurred_at ?? null,
        hasPhone: !!d.contacts?.phone, hasEmail: !!d.contacts?.email, hasAttribution: !!a,
      });
      const lastChange = h.length ? h[h.length - 1].changed_at : d.created_at;
      const lastAct: any = data.acts.find((x: any) => x.deal_id === d.id);
      const outcome = lastAct?.metadata?.result ?? lastAct?.metadata?.activity_kind_label ?? lastAct?.type ?? null;
      return {
        id: d.id, name: d.contacts?.name ?? d.name, origin: leadOriginLabel(a?.source_kind ?? d.source ?? d.contacts?.source),
        campaign: a?.utm_campaign ?? null, utm: a ? [a.utm_source, a.utm_medium].filter(Boolean).join(" / ") : "",
        adId: a?.meta_ad_id ?? null, createdAt: d.created_at, stageDates, score, stageId: d.stage_id, stageName: d.stage_name,
        daysInStage: days(lastChange), totalDays: days(d.created_at, d.won_at), status: d.is_won ? "Ganado" : d.is_lost ? "Perdido" : "Abierto",
        ownerId: d.owner_id, ownerName: users.find((u) => u.id === d.owner_id)?.name ?? "Sin asignar",
        outcome, outcomeAt: lastAct?.occurred_at ?? null, advanced: h.length > 0 || d.is_won,
      };
    });
  }, [data, users]);

  const campaigns = useMemo(() => Array.from(new Set(rows.map((r) => r.campaign).filter(Boolean))) as string[], [rows]);
  const stageCols = useMemo(() => {
    const pipes = new Set((data?.deals ?? []).map((d: any) => data?.stages.find((s: any) => s.id === d.stage_id)?.pipeline_id).filter(Boolean));
    return (data?.stages ?? []).filter((s: any) => pipes.has(s.pipeline_id) && !s.is_lost).map((s: any) => s.name as string)
      .filter((n: string, i: number, arr: string[]) => arr.indexOf(n) === i);
  }, [rows, data]);

  const filtered = rows.filter((r) =>
    (origin === "all" || r.origin === origin) && (campaign === "all" || r.campaign === campaign) &&
    (owner === "all" || r.ownerId === owner) && (stage === "all" || r.stageName === stage));

  const summary = useMemo(() => {
    const m = new Map<string, { key: string; leads: number; advanced: number; won: number }>();
    filtered.forEach((r) => {
      const key = `${r.origin}${r.campaign ? " · " + r.campaign : ""}`;
      const e = m.get(key) ?? { key, leads: 0, advanced: 0, won: 0 };
      e.leads++; if (r.advanced) e.advanced++; if (r.status === "Ganado") e.won++;
      m.set(key, e);
    });
    return Array.from(m.values()).sort((a, b) => b.leads - a.leads);
  }, [filtered]);

  const exportCsv = () => {
    const head = ["Lead", "Origen", "Campaña", "UTM", "Anuncio", "Score", "Entrada", ...stageCols, "Etapa actual", "Días en etapa", "Días totales", "Estado", "Último resultado", "Asesor"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((r) => [r.name, r.origin, r.campaign, r.utm, r.adId, r.score, r.createdAt?.slice(0, 10),
      ...stageCols.map((s) => r.stageDates[s]?.slice(0, 10) ?? ""), r.stageName, r.daysInStage, r.totalDays, r.status, r.outcome, r.ownerName].map(esc).join(","));
    downloadCSV(`recorrido-leads-${new Date().toISOString().slice(0, 10)}.csv`, [head.map(esc).join(","), ...lines].join("\n"));
  };

  const stageNames = Array.from(new Set(rows.map((r) => r.stageName).filter(Boolean)));

  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border">
        <Route className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm mr-auto">Recorrido de leads</h3>
        <Pick value={period} onChange={setPeriod} items={[["7", "7 días"], ["30", "30 días"], ["90", "90 días"], ["365", "12 meses"]]} />
        <Pick value={origin} onChange={setOrigin} items={[["all", "Todos los orígenes"], ...LEAD_ORIGINS.map((o) => [o, o] as [string, string])]} />
        <Pick value={campaign} onChange={setCampaign} items={[["all", "Todas las campañas"], ...campaigns.map((c) => [c, c] as [string, string])]} />
        <Pick value={owner} onChange={setOwner} items={[["all", "Todos los asesores"], ...users.map((u) => [u.id, u.name] as [string, string])]} />
        <Pick value={stage} onChange={setStage} items={[["all", "Todas las etapas"], ...stageNames.map((s) => [s, s] as [string, string])]} />
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={exportCsv} title="Descargar CSV"><Download className="h-4 w-4" /></Button>
      </div>

      {summary.length > 0 && (
        <div className="px-4 py-3 border-b border-border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Origen · campaña</TableHead><TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Avanzaron</TableHead><TableHead className="text-right">Ganados</TableHead><TableHead className="text-right">Conversión</TableHead>
            </TableRow></TableHeader>
            <TableBody>{summary.map((s) => (
              <TableRow key={s.key}>
                <TableCell className="text-sm">{s.key}</TableCell><TableCell className="text-right">{s.leads}</TableCell>
                <TableCell className="text-right">{s.advanced}</TableCell><TableCell className="text-right">{s.won}</TableCell>
                <TableCell className="text-right">{s.leads ? Math.round((s.won / s.leads) * 100) : 0}%</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Lead</TableHead><TableHead>Origen</TableHead><TableHead>Campaña / UTM</TableHead><TableHead className="text-center" title="Avance en el embudo, seguimiento, recencia y datos completos">Score</TableHead><TableHead>Entrada</TableHead>
            {stageCols.map((s) => <TableHead key={s} className="whitespace-nowrap">{s}</TableHead>)}
            <TableHead>Etapa actual</TableHead><TableHead className="text-right">Días en etapa</TableHead>
            <TableHead>Último resultado</TableHead><TableHead>Asesor</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium whitespace-nowrap">{r.name}</TableCell>
                <TableCell><LeadSourceBadge source={r.origin} /></TableCell>
                <TableCell className="text-xs"><div>{r.campaign ?? "—"}</div><div className="text-muted-foreground">{r.utm}</div></TableCell>
                <TableCell className="text-center"><span className={`inline-block min-w-8 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreClass(r.score)}`}>{r.score}</span></TableCell>
                <TableCell className="text-xs whitespace-nowrap">{fmt(r.createdAt)}</TableCell>
                {stageCols.map((s) => <TableCell key={s} className="text-xs whitespace-nowrap">{fmt(r.stageDates[s])}</TableCell>)}
                <TableCell className="text-xs whitespace-nowrap">{r.stageName}{r.status !== "Abierto" && <span className="text-muted-foreground"> · {r.status}</span>}</TableCell>
                <TableCell className="text-right text-xs">{r.daysInStage}</TableCell>
                <TableCell className="text-xs max-w-[180px] truncate" title={r.outcome ?? ""}>{r.outcome ?? "—"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.ownerName}</TableCell>
              </TableRow>
            ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={9 + stageCols.length} className="text-center text-sm text-muted-foreground py-8">Sin leads en este periodo.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function Pick({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>{items.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}
