import { createElement } from "react";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({filters:[] as [string,string,unknown][],invoke:vi.fn()}));
vi.mock("./tenant",()=>({useTenantId:()=>({data:"tenant"})}));
vi.mock("./tenantUsers",()=>({useTenantUsers:()=>({data:[{id:"user",name:"Ana"}]})}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{functions:{invoke:state.invoke},from:(table:string)=>{
  const chain:any={};
  for(const method of ["select","eq","gte","lte","order","range"]) chain[method]=(...args:unknown[])=>{if(["eq","gte","lte"].includes(method))state.filters.push([table,String(args[0]),args[1]]);return chain;};
  chain.then=(resolve:any)=>resolve({error:null,data:table==="activities" ? [{id:"activity",tenant_id:"tenant",contact_id:"contact",type:"call",description:"Llamada finalizada",occurred_at:"2026-11-21T20:00:00Z",agent_id:"user",metadata:{source:"automatic_call_result",call_id:"call"},contacts:{name:"Juan"}}] : table==="calls" ? [{id:"call",tenant_id:"tenant",contact_id:"contact",direction:"inbound",user_id:"user",created_at:"2026-11-21T20:00:00Z",ended_at:null,hangup_by:null,hangup_at:null,contacts:{name:"Juan"}}] : []});
  return chain;
}}}));
import { useTeamActivity } from "./teamActivity";
afterEach(cleanup);
it("scopes all activity sources to tenant and period and counts one inbound call without any AI request",async()=>{
  state.filters=[];state.invoke.mockClear();
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const wrapper=({children}:{children:React.ReactNode})=>createElement(QueryClientProvider,{client},children);
  const {result}=renderHook(()=>useTeamActivity({preset:"custom",from:"2026-11-20",to:"2026-11-22"}),{wrapper});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(1);
  expect(result.current.data?.[0]).toMatchObject({type:"inbound_call",userId:"user",userName:"Ana",contact:"Juan"});
  for(const table of ["activities","calls","deal_stage_history"]){
    expect(state.filters).toContainEqual([table,"tenant_id","tenant"]);
    const dateColumn = table==="calls"?"created_at":table==="activities"?"occurred_at":"changed_at";
    expect(state.filters).toContainEqual([table,dateColumn,"2026-11-20T06:00:00.000Z"]);
    expect(state.filters).toContainEqual([table,dateColumn,"2026-11-23T05:59:59.999Z"]);
  }
  expect(state.invoke).not.toHaveBeenCalled();client.clear();
});