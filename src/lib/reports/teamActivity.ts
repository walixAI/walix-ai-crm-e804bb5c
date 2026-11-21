import * as XLSX from "xlsx";
import { TEAM_ACTIVITY_TYPES } from "./reportRules";

export interface TeamActivityRow { id: string; at: string; userId: string | null; userName: string; type: string; description: string; contact: string; }
export function filterTeamActivity(rows: TeamActivityRow[], type: string, userId: string) {
  return rows.filter(r => (type === "all" || r.type === type) && (userId === "all" || (userId === "unassigned" ? !r.userId : r.userId === userId)));
}
export function teamActivityWorkbook(rows: TeamActivityRow[]) {
  const sheet=XLSX.utils.json_to_sheet(rows.map(r=>({
    "Fecha y hora (México)": new Date(r.at).toLocaleString("es-MX",{timeZone:"America/Mexico_City"}),
    "Usuario":r.userName,"Tipo de actividad":TEAM_ACTIVITY_TYPES.find(([key])=>key===r.type)?.[1] ?? r.type,
    "Contacto":r.contact,"Descripción":r.description,
  })),{header:["Fecha y hora (México)","Usuario","Tipo de actividad","Contacto","Descripción"]});
  sheet["!cols"]=[{wch:26},{wch:26},{wch:28},{wch:30},{wch:65}];
  const book=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,sheet,"Actividad del equipo"); return book;
}
export function exportTeamActivity(rows: TeamActivityRow[]) { XLSX.writeFile(teamActivityWorkbook(rows),`actividad-equipo-${new Date().toISOString().slice(0,10)}.xlsx`); }