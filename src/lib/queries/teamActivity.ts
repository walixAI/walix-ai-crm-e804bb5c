import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "./tenant";
import { useTenantUsers } from "./tenantUsers";
import { readAllPages } from "./paginate";
import { resolvePeriodRange } from "./reports";
import type { PeriodValue } from "@/lib/reports/filters";
import { consolidateCallActivities } from "@/lib/activities/consolidateCalls";
import { classifyTeamActivity } from "@/lib/reports/reportRules";
import type { TeamActivityRow } from "@/lib/reports/teamActivity";

export function useTeamActivity(period: PeriodValue) {
  const { data:tenantId }=useTenantId();
  const { data:users=[] }=useTenantUsers();
  return useQuery({
    queryKey:["team-activity",tenantId,period.preset,period.from,period.to,users.map(u=>`${u.id}:${u.name}`).join(",")],
    enabled:!!tenantId,refetchInterval:60000,
    queryFn:async():Promise<TeamActivityRow[]>=>{
      if(!tenantId) return [];
      const {from,to}=resolvePeriodRange(period);
      const [activities,calls,history]=await Promise.all([
        readAllPages((a,b)=>supabase.from("activities").select("id,tenant_id,contact_id,deal_id,type,description,occurred_at,metadata,agent_id,contacts(name)").eq("tenant_id",tenantId).gte("occurred_at",from.toISOString()).lte("occurred_at",to.toISOString()).order("id").range(a,b)),
        readAllPages((a,b)=>supabase.from("calls").select("id,tenant_id,contact_id,direction,user_id,status,created_at,ended_at,hangup_by,hangup_at,contacts(name)").eq("tenant_id",tenantId).gte("created_at",from.toISOString()).lte("created_at",to.toISOString()).order("id").range(a,b)),
        readAllPages((a,b)=>supabase.from("deal_stage_history").select("id,deal_id,changed_at,changed_by,from_stage_name,to_stage_name").eq("tenant_id",tenantId).gte("changed_at",from.toISOString()).lte("changed_at",to.toISOString()).order("id").range(a,b)),
      ]);
      const callMap=new Map(calls.map(c=>[c.id,c]));
      const name=(id:string|null)=>users.find(u=>u.id===id)?.name ?? (id ? "Usuario no disponible" : "Sistema / sin asignar");
      const rows:TeamActivityRow[]=consolidateCallActivities(activities,calls).map(a=>{
        const meta=(a.metadata ?? {}) as Record<string,unknown>;
        const call=typeof meta.call_id==="string" ? callMap.get(meta.call_id) : undefined;
        const userId=a.agent_id ?? call?.user_id ?? null;
        return {id:a.id,at:a.occurred_at,userId,userName:name(userId),type:classifyTeamActivity(a.type,meta,call?.direction),description:a.description ?? "",contact:a.contacts?.name ?? "—"};
      });
      const linked=new Set(activities.map(a=>(a.metadata as Record<string,unknown>|null)?.call_id).filter(Boolean));
      for(const c of calls) if(!linked.has(c.id)) rows.push({id:`call:${c.id}`,at:c.created_at,userId:c.user_id,userName:name(c.user_id),type:classifyTeamActivity("call",{},c.direction),description:({completed:"Llamada terminada",answered:"Llamada en curso",no_answer:"Sin respuesta",busy:"Ocupado",failed:"Llamada fallida",ringing:"Sonando",queued:"En espera",voicemail:"Buzón"} as Record<string,string>)[c.status] ?? c.status,contact:c.contacts?.name ?? "—"});
      for(const h of history) rows.push({id:`stage:${h.id}`,at:h.changed_at,userId:h.changed_by,userName:name(h.changed_by),type:"deal",description:`${h.from_stage_name ?? "Sin etapa"} → ${h.to_stage_name ?? "Sin etapa"}`,contact:"—"});
      return rows.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id));
    },
  });
}