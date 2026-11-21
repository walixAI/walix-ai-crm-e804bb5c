import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Route } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { useTenantUsers } from "@/lib/queries/tenantUsers";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadSourceBadge, leadOriginLabel, LEAD_ORIGINS } from "@/components/walix/LeadSourceBadge";
import { downloadCSV } from "@/lib/reports/exportCsv";
import { readAllPages } from "@/lib/queries/paginate";
import { uniqueLeadDeals } from "@/lib/reports/reportRules";
import { consolidateCallActivities } from "@/lib/activities/consolidateCalls";
import { Link } from "react-router-dom";

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
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => { setPage(0); setExpanded(null); }, [period, origin, campaign, owner, stage]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["lead-journey", tenantId, period],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return { deals: [], hist: [], attr: [], acts: [], stages: [] };
      const since = new Date(Date.now() - PERIODS[period] * 86400000).toISOString();
      const allDeals = await readAllPages((start,end) => supabase.from("deals")
        .select("id, name, amount, contact_id, owner_id, stage_id, stage_name, source, is_won, is_lost, created_at, won_at, lost_at, contacts(name, source, phone, email)")
        .eq("tenant_id", tenantId).gte("created_at", since).order("created_at", { ascending: false }).order("id").range(start,end));
      const deals=uniqueLeadDeals(allDeals);
      const ids=deals.map(d=>d.id);
      const cids=[...new Set(deals.flatMap(d=>d.contact_id ? [d.contact_id] : []))];
      const batches = async <T,>(keys:string[],fetch:(chunk:string[])=>Promise<T[]>) => {
        const result:T[]=[];
        for(let i=0;i<keys.length;i+=100) result.push(...await fetch(keys.slice(i,i+100)));
        return result;
      };
      const [hist, attr, acts, stages] = await Promise.all([
        batches(ids,chunk=>readAllPages((start,end)=>supabase.from("deal_stage_history").select("id, deal_id, to_stage_id, to_stage_name, changed_at").eq("tenant_id",tenantId).in("deal_id",chunk).order("changed_at").order("id").range(start,end))),
        batches(cids,chunk=>readAllPages((start,end)=>supabase.from("contact_attribution").select("id,contact_id,source_kind,utm_campaign,utm_source,utm_medium,meta_ad_id,created_at").eq("tenant_id",tenantId).in("contact_id",chunk).eq("touch_type","first").order("created_at").order("id").range(start,end))),
        batches(ids,chunk=>readAllPages((start,end)=>supabase.from("activities").select("id,tenant_id,contact_id,deal_id,type,description,occurred_at,metadata").eq("tenant_id",tenantId).in("deal_id",chunk).order("occurred_at",{ascending:false}).order("id").range(start,end))),
        readAllPages((start,end)=>supabase.from("pipeline_stages").select("id,name,position,pipeline_id,is_won,is_lost").eq("tenant_id",tenantId).order("position").order("id").range(start,end)),
      ]);
      return { deals, hist, attr, acts:consolidateCallActivities(acts), stages };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const attrBy = new Map<string, any>();
    for(const a of data.attr) if(!attrBy.has(a.contact_id)) attrBy.set(a.contact_id,a);
    return data.deals.map((d: any) => {
      const a: any = attrBy.get(d.contact_id);
      const h = data.hist.filter((x: any) => x.deal_id === d.id);
      const stageDates: Record<string, string> = {};
      h.forEach((x: any) => { if (x.to_stage_name && !stageDates[x.to_stage_name]) stageDates[x.to_stage_name] = x.changed_at; });
      // Only recorded stage events count as reached stages.
      const st = data.stages.find((x: any) => x.id === d.stage_id);
      const pipeStages = data.stages.filter((x: any) => x.pipeline_id === st?.pipeline_id && !x.is_lost);

      const dealActs = data.acts.filter((x: any) => x.deal_id === d.id);
      const score = leadScore({
        stagePos: st && pipeStages.length > 1 ? Math.max(0, pipeStages.findIndex((x: any) => x.id === st.id)) / (pipeStages.length - 1) : 0,
        isWon: d.is_won, isLost: d.is_lost, activities: dealActs.length,
        lastActivityAt: dealActs[0]?.occurred_at ?? null,
        hasPhone: !!d.contacts?.phone, hasEmail: !!d.contacts?.email, hasAttribution: !!a,
      });
      const currentChanges=h.filter((x:any)=>x.to_stage_id===d.stage_id);
      const lastChange = currentChanges.length ? currentChanges[currentChanges.length - 1].changed_at : null;
      const lastAct: any = data.acts.find((x: any) => x.deal_id === d.id);
      const outcome = lastAct?.metadata?.result ?? lastAct?.metadata?.activity_kind_label ?? lastAct?.type ?? null;
      return {
        id: d.id, contactId: d.contact_id, opportunity: d.name, name: d.contacts?.name ?? d.name, origin: leadOriginLabel(a?.source_kind ?? d.source ?? d.contacts?.source),
        campaign: a?.utm_campaign ?? null, utm: a ? [a.utm_source, a.utm_medium].filter(Boolean).join(" / ") : "",
        adId: a?.meta_ad_id ?? null, createdAt: d.created_at, stageDates, score, stageId: d.stage_id, stageName: d.stage_name,
        daysInStage: lastChange ? days(lastChange, d.won_at ?? d.lost_at) : null, totalDays: days(d.created_at, d.won_at ?? d.lost_at), status: d.is_won ? "Ganado" : d.is_lost ? "Perdido" : "Abierto",
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

  const pages=Math.max(1,Math.ceil(filtered.length/15));
  const currentPage=Math.min(page,pages-1);
  const visible=filtered.slice(currentPage*15,(currentPage+1)*15);

  const exportCsv = () => {
    const head = ["Lead", "Origen", "Campaña", "UTM", "Anuncio", "Score", "Entrada", ...stageCols, "Etapa actual", "Días en etapa", "Días totales", "Estado", "Último resultado", "Asesor"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((r) => [r.name, r.origin, r.campaign, r.utm, r.adId, r.score, r.createdAt?.slice(0, 10),
      ...stageCols.map((s) => r.stageDates[s]?.slice(0, 10) ?? ""), r.stageName, r.daysInStage, r.totalDays, r.status, r.outcome, r.ownerName].map(esc).join(","));
    downloadCSV(`recorrido-leads-${new Date().toISOString().slice(0, 10)}.csv`, [head.map(esc).join(","), ...lines].join("\n"));
  };

  const stageNames = Array.from(new Set(rows.map((r) => r.stageName).filter(Boolean)));

  return (
    <section className="border-y border-border py-5 space-y-4" aria-label="Recorrido de leads">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Route className="h-4 w-4 text-muted-foreground" /><h2 className="font-semibold text-base">Recorrido de leads</h2></div>
        <Button size="sm" variant="outline" disabled={isLoading||isError||!filtered.length} onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Pick label="Periodo del recorrido" value={period} onChange={setPeriod} items={[["7", "7 días"], ["30", "30 días"], ["90", "90 días"], ["365", "12 meses"]]} />
        <Pick label="Origen del lead" value={origin} onChange={setOrigin} items={[["all", "Todos los orígenes"], ...LEAD_ORIGINS.map(o=>[o,o] as [string,string])]} />
        <Pick label="Campaña del lead" value={campaign} onChange={setCampaign} items={[["all","Todas las campañas"],...campaigns.map(c=>[c,c] as [string,string])]} />
        <Pick label="Asesor del lead" value={owner} onChange={setOwner} items={[["all","Todos los asesores"],...users.map(u=>[u.id,u.name] as [string,string])]} />
        <Pick label="Etapa del lead" value={stage} onChange={setStage} items={[["all","Todas las etapas"],...stageNames.map(n=>[n,n] as [string,string])]} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-3 text-sm">
        <span><strong>{filtered.length}</strong> leads</span><span className="text-muted-foreground"><strong className="text-foreground">{filtered.filter(r=>r.advanced).length}</strong> con avance</span><span className="text-muted-foreground"><strong className="text-success">{filtered.filter(r=>r.status==="Ganado").length}</strong> ganados</span>
      </div>
      {isLoading ? <p className="py-8 text-sm text-muted-foreground">Cargando recorridos…</p> : isError ? <p role="alert" className="py-8 text-sm text-destructive">No se pudo cargar el recorrido de leads.</p> : !visible.length ? <p className="py-8 text-center text-sm text-muted-foreground">Sin leads con estos filtros.</p> : <div className="max-h-[560px] overflow-y-auto overscroll-contain divide-y divide-border pr-2" tabIndex={0} aria-label="Lista de recorridos">
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_40px] gap-4 py-2 text-xs text-muted-foreground"><span>Lead / origen</span><span>Etapa actual</span><span>Asesor</span><span>Entrada / tiempo en etapa</span><span /></div>
        {visible.map(r=><div key={r.id} className="py-4">
          <div className="grid grid-cols-[1fr_auto] items-start gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_40px] md:gap-4">
            <div className="min-w-0">{r.contactId ? <Link to={`/contacts/${r.contactId}`} className="text-sm font-semibold break-words hover:underline">{r.name}</Link> : <span className="text-sm font-semibold">{r.name}</span>}<div className="mt-1 flex flex-wrap items-center gap-2"><LeadSourceBadge source={r.origin} /><span className="text-xs text-muted-foreground break-words">{r.campaign}</span></div></div>
            <div className="col-start-1 md:col-start-auto"><p className="text-sm font-medium break-words">{r.stageName ?? "Sin etapa"}</p><p className="mt-1 text-xs text-muted-foreground">{r.status}</p></div>
            <p className="text-xs text-muted-foreground break-words">{r.ownerName}</p>
            <div className="text-xs text-muted-foreground"><span>{fmt(r.createdAt)}</span><p className="mt-1">{r.daysInStage == null ? "Sin fecha de etapa" : `${r.daysInStage} días en etapa`}</p></div>
            <Button className="col-start-2 row-start-1 md:col-start-auto md:row-start-auto" size="icon" variant="ghost" aria-label={`Recorrido de ${r.name}`} title="Ver recorrido" aria-expanded={expanded===r.id} onClick={()=>setExpanded(expanded===r.id ? null : r.id)}><ChevronDown className={`h-4 w-4 transition-transform ${expanded===r.id ? "rotate-180" : ""}`} /></Button>
          </div>
          {expanded===r.id && <div className="mt-4 border-l-2 border-primary/30 pl-4 space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground"><span>Oportunidad: <strong className="text-foreground">{r.opportunity}</strong></span><span>Campaña: {r.campaign ?? "—"}</span><span>UTM: {r.utm || "—"}</span><span>Anuncio: {r.adId ?? "—"}</span><span>Puntaje: <strong className={scoreClass(r.score)}>{r.score}</strong></span></div>
            <ol className="space-y-2">{Object.entries(r.stageDates).map(([name,date])=><li key={name} className="flex flex-wrap gap-x-4 gap-y-1 text-xs"><time className="text-muted-foreground" dateTime={date}>{fmt(date)}</time><span className="font-medium">{name}</span></li>)}{!Object.keys(r.stageDates).length && <li className="text-xs text-muted-foreground">Sin movimientos de etapa registrados.</li>}</ol>
            <p className="text-xs break-words"><span className="text-muted-foreground">Último resultado: </span>{r.outcome ?? "Sin resultado registrado"}</p>
          </div>}
        </div>)}
      </div>}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground"><span>{filtered.length ? currentPage*15+1 : 0}–{Math.min((currentPage+1)*15,filtered.length)} de {filtered.length} leads</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Leads anteriores" disabled={!currentPage} onClick={()=>{setPage(currentPage-1);setExpanded(null);}}><ChevronLeft className="h-4 w-4" /></Button><span>{currentPage+1} / {pages}</span><Button variant="outline" size="icon" aria-label="Leads siguientes" disabled={currentPage>=pages-1} onClick={()=>{setPage(currentPage+1);setExpanded(null);}}><ChevronRight className="h-4 w-4" /></Button></div></div>
    </section>
  );
}

function Pick({ label, value, onChange, items }: { label: string; value: string; onChange: (v: string) => void; items: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="h-9 w-full sm:w-auto sm:min-w-[140px] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>{items.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}
