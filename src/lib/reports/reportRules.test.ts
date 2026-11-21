import { describe,it,expect } from "vitest";
import { buildStageReports,uniqueLeadDeals,classifyTeamActivity } from "./reportRules";
describe("report duplicate rules",()=>{
  const stage=(id:string,name:string,position:number,pipeline_id="p1")=>({id,name,position,pipeline_id,is_won:false,is_lost:false});
  it("combines repeated stage labels inside a pipeline without counting a deal twice",()=>{
    const d={id:"d",stage_id:"a2",amount:100};
    const r=buildStageReports([stage("a","Nuevo",0),stage("a2"," Nuevo ",0),stage("b","Contactado",1)],[d,d],[]);
    expect(r.funnel).toHaveLength(2); expect(r.funnel[0].count).toBe(1); expect(r.funnel[0].value).toBe(100);
  });
  it("does not invent transitions between different pipelines",()=>{
    expect(buildStageReports([stage("a","Nuevo",0),stage("b","Contactado",1,"p2")],[],[]).stageConversions).toHaveLength(0);
  });
  it("counts a repeatedly advanced opportunity once with an eligible denominator",()=>{
    const h={deal_id:"d1",from_stage_id:"a",to_stage_id:"b",from_stage_name:"Nuevo",to_stage_name:"Contactado"};
    const r=buildStageReports([stage("a","Nuevo",0),stage("b","Contactado",1)],[{id:"d2",stage_id:"a",amount:0}],[h,h]);
    expect(r.stageConversions[0]).toMatchObject({advanced:1,eligible:2,rate:50});
  });
  it("shows one lead per contact preferring newest open opportunity",()=>{
    const d=(id:string,date:string,won=false)=>({id,contact_id:"c",created_at:date,is_won:won,is_lost:false,stage_id:"a",amount:0});
    expect(uniqueLeadDeals([d("older","2026-11-01"),d("open","2026-11-10"),d("closed","2026-11-20",true)]).map(x=>x.id)).toEqual(["open"]);
  });
  it("distinguishes calls using recorded direction and keeps unknown direction separate",()=>{
    expect(classifyTeamActivity("call",{},"inbound")).toBe("inbound_call");
    expect(classifyTeamActivity("call",{},"outbound")).toBe("outbound_call");
    expect(classifyTeamActivity("call",{})).toBe("call");
    expect(classifyTeamActivity("wa_sent",{})).toBe("whatsapp");
    expect(classifyTeamActivity("email",{})).toBe("email");
  });
});