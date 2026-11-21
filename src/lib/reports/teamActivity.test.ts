import { it,expect } from "vitest";
import * as XLSX from "xlsx";
import { filterTeamActivity,teamActivityWorkbook,type TeamActivityRow } from "./teamActivity";
const rows:TeamActivityRow[]=[{id:"1",at:"2026-11-21T20:38:00Z",userId:"a",userName:"Ana",type:"inbound_call",description:"Contestó",contact:"Juan"},{id:"2",at:"2026-11-21T20:39:00Z",userId:"b",userName:"Luis",type:"email",description:"Cotización",contact:"Pedro"}];
it("combines user and activity filters without leaking other users into export",()=>{
  const filtered=filterTeamActivity(rows,"inbound_call","a");
  expect(filtered.map(r=>r.id)).toEqual(["1"]);
  expect(filterTeamActivity(rows,"email","a")).toEqual([]);
  const bytes=XLSX.write(teamActivityWorkbook(filtered),{type:"array",bookType:"xlsx"});
  const book=XLSX.read(bytes,{type:"array"});
  expect(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]])).toEqual([{"Fecha y hora (México)":"21/11/2026, 2:38:00 p.m.","Usuario":"Ana","Tipo de actividad":"Llamada entrante","Contacto":"Juan","Descripción":"Contestó"}]);
});