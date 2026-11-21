import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useReportsContext } from "@/lib/reports/context";

export function StageConversionsSection() {
  const {data,isLoading}=useReportsContext();
  const [pipeline,setPipeline]=useState("");
  const all=data?.stageConversions ?? [];
  const pipelines=[...new Map(all.map(s=>[s.pipelineId ?? "default",s.pipelineName ?? "Proceso de ventas"])).entries()];
  const selected=pipelines.some(([id])=>id===pipeline) ? pipeline : all.find(s=>s.advanced>0)?.pipelineId ?? pipelines[0]?.[0] ?? "default";
  const conversions=all.filter(s=>(s.pipelineId ?? "default")===selected);
  return <section className="border-y border-border py-5 space-y-4" aria-label="Conversiones por etapa">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-base">Conversiones por etapa</h2><p className="text-xs text-muted-foreground">Oportunidades únicas que avanzaron en el periodo</p></div>
      {pipelines.length>1 && <Select value={selected} onValueChange={setPipeline}><SelectTrigger className="w-full sm:w-64" aria-label="Proceso de conversiones"><SelectValue /></SelectTrigger><SelectContent>{pipelines.map(([id,name])=><SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>}
    </div>
    {isLoading ? <Skeleton className="h-48" /> : conversions.length===0 ? <p className="py-8 text-sm text-muted-foreground">Sin etapas consecutivas configuradas.</p> : <>
      <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 border-b border-border pb-2 text-xs text-muted-foreground"><span>Transición</span><span className="text-right">En etapa de origen</span><span className="text-right">Avanzaron</span><span className="text-right">Conversión</span></div>
      <div className="divide-y divide-border">{conversions.map(c=><div key={`${c.pipelineId}:${c.from}:${c.to}`} className="grid grid-cols-3 gap-3 py-4 sm:grid-cols-[2fr_1fr_1fr_1fr] sm:gap-4 sm:items-center">
        <div className="col-span-3 flex items-center gap-2 min-w-0 text-sm font-medium sm:col-span-1"><span className="break-words">{c.from}</span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="break-words">{c.to}</span></div>
        <div className="sm:text-right"><div className="text-xs text-muted-foreground sm:hidden">En origen</div><span className="font-semibold tabular-nums">{c.eligible ?? 0}</span></div>
        <div className="sm:text-right"><div className="text-xs text-muted-foreground sm:hidden">Avanzaron</div><span className="font-semibold tabular-nums">{c.advanced}</span></div>
        <div className="text-right"><span className="text-lg font-semibold tabular-nums">{c.eligible ? `${c.rate}%` : "—"}</span><progress value={c.rate} max={100} aria-label={`Conversión de ${c.from} a ${c.to}`} className="mt-1 block h-1.5 w-full overflow-hidden rounded bg-muted accent-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" /></div>
      </div>)}</div>
    </>}
  </section>;
}
