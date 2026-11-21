import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useReportsContext } from "@/lib/reports/context";
import { TEAM_ACTIVITY_TYPES } from "@/lib/reports/reportRules";
import { exportTeamActivity, filterTeamActivity } from "@/lib/reports/teamActivity";
import { useTeamActivity } from "@/lib/queries/teamActivity";
import type { PeriodValue } from "@/lib/reports/filters";
import { PeriodPicker } from "./PeriodPicker";

export function TeamActivityHeatmap() {
  const {users}=useReportsContext();
  const [period,setPeriod]=useState<PeriodValue>({preset:"month"});
  const [type,setType]=useState("all");
  const [user,setUser]=useState("all");
  const [page,setPage]=useState(0);
  const {data=[],isLoading,isError}=useTeamActivity(period);
  const rows=useMemo(()=>filterTeamActivity(data,type,user),[data,type,user]);
  useEffect(()=>setPage(0),[type,user,period]);
  const pages=Math.max(1,Math.ceil(rows.length/15));
  const current=Math.min(page,pages-1);
  const summary=new Map<string,number>();
  for(const row of rows) summary.set(row.type,(summary.get(row.type) ?? 0)+1);
  return <section className="border-y border-border py-5 space-y-4" aria-label="Actividad del equipo">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-base">Actividad del equipo</h2><Button size="sm" variant="outline" disabled={isLoading||isError||!rows.length} onClick={()=>exportTeamActivity(rows)}><FileSpreadsheet className="mr-2 h-4 w-4" />Exportar Excel</Button></div>
    <div className="flex flex-wrap gap-2"><PeriodPicker value={period} onChange={setPeriod} />
      <Select value={type} onValueChange={setType}><SelectTrigger className="w-full sm:w-64" aria-label="Tipo de actividad"><SelectValue /></SelectTrigger><SelectContent>{TEAM_ACTIVITY_TYPES.map(([key,label])=><SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
      <Select value={user} onValueChange={setUser}><SelectTrigger className="w-full sm:w-56" aria-label="Usuario de actividad"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los usuarios</SelectItem><SelectItem value="unassigned">Sistema / sin asignar</SelectItem>{users.map(u=><SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select>
    </div>
    <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-3 text-xs"><span className="font-semibold">{rows.length} {rows.length===1 ? "actividad" : "actividades"}</span>{[...summary].map(([key,count])=><span key={key} className="text-muted-foreground">{TEAM_ACTIVITY_TYPES.find(([id])=>id===key)?.[1]} <strong className="text-foreground">{count}</strong></span>)}</div>
    {isLoading ? <Skeleton className="h-48" /> : isError ? <p role="alert" className="text-sm text-destructive">No se pudo cargar la actividad del equipo.</p> : !rows.length ? <p className="py-8 text-center text-sm text-muted-foreground">Sin actividades con estos filtros.</p> : <div className="divide-y divide-border">{rows.slice(current*15,(current+1)*15).map(r=><div key={r.id} className="grid gap-2 py-3 sm:grid-cols-[155px_170px_1fr]">
      <div className="text-xs text-muted-foreground"><time dateTime={r.at}>{new Date(r.at).toLocaleString("es-MX",{timeZone:"America/Mexico_City",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</time><div className="mt-1 font-medium text-foreground break-words">{r.userName}</div></div>
      <div><span className="text-xs font-semibold">{TEAM_ACTIVITY_TYPES.find(([id])=>id===r.type)?.[1]}</span><p className="mt-1 text-xs text-muted-foreground break-words">{r.contact}</p></div>
      <p className="text-sm line-clamp-2 break-words" title={r.description}>{r.description}</p>
    </div>)}</div>}
    <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground"><span>{rows.length ? current*15+1 : 0}–{Math.min((current+1)*15,rows.length)} de {rows.length}</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Actividad anterior" disabled={!current} onClick={()=>setPage(current-1)}><ChevronLeft className="h-4 w-4" /></Button><span>{current+1} / {pages}</span><Button variant="outline" size="icon" aria-label="Actividad siguiente" disabled={current>=pages-1} onClick={()=>setPage(current+1)}><ChevronRight className="h-4 w-4" /></Button></div></div>
  </section>;
}
