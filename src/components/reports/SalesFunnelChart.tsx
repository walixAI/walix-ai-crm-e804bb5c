import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReportsContext } from "@/lib/reports/context";
import { formatMXN } from "@/lib/reports/format";
import { Skeleton } from "@/components/ui/skeleton";

export function SalesFunnelChart() {
  const navigate=useNavigate();
  const {data,isLoading}=useReportsContext();
  const [pipeline,setPipeline]=useState("");
  const pipelines=[...new Map((data?.funnel ?? []).map(s=>[s.pipelineId ?? "default",s.pipelineName ?? "Proceso de ventas"])).entries()];
  const selected=pipelines.some(([id])=>id===pipeline) ? pipeline : data?.funnel.find(s=>s.count>0)?.pipelineId ?? pipelines[0]?.[0] ?? "default";
  const stages=(data?.funnel ?? []).filter(s=>(s.pipelineId ?? "default")===selected);
  const total=stages.reduce((sum,s)=>sum+s.count,0);
  const max=Math.max(1,...stages.map(s=>s.count));
  return <section className="border-y border-border py-5 space-y-4" aria-label="Embudo de ventas">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold">Embudo de ventas</h2><p className="text-xs text-muted-foreground">{total} oportunidades · distribución por etapa actual</p></div>
      {pipelines.length>1 && <Select value={selected} onValueChange={setPipeline}><SelectTrigger className="w-full sm:w-64" aria-label="Proceso del embudo"><SelectValue /></SelectTrigger><SelectContent>{pipelines.map(([id,name])=><SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>}
    </div>
    {isLoading ? <Skeleton className="h-48" /> : stages.length===0 ? <p className="py-8 text-sm text-muted-foreground">Sin etapas configuradas.</p> : <div className="divide-y divide-border">{stages.map((s,i)=><div key={s.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(150px,1fr)_2fr_auto_auto] sm:items-center">
      <div className="flex min-w-0 gap-3 items-center"><span className="text-xs tabular-nums text-muted-foreground">{String(i+1).padStart(2,"0")}</span><span className="text-sm font-medium break-words">{s.name}</span></div>
      <progress aria-label={`Oportunidades en ${s.name}`} value={s.count} max={max} className="col-span-2 row-start-2 h-2 w-full overflow-hidden rounded bg-muted accent-primary sm:col-span-1 sm:row-start-auto [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" />
      <div className="text-right"><div className="text-sm font-semibold tabular-nums">{s.count}</div><div className="text-xs text-muted-foreground whitespace-nowrap">{formatMXN(s.value)}</div></div>
      <Button variant="ghost" size="icon" className="hidden sm:inline-flex" title={`Ver oportunidades en ${s.name}`} aria-label={`Ver oportunidades en ${s.name}`} onClick={()=>navigate(`/pipeline?stage=${s.id}`)}><ArrowRight className="h-4 w-4" /></Button>
    </div>)}</div>}
  </section>;
}
