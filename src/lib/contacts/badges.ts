export type LeadStatus =
  | "Nuevo"
  | "Contactado"
  | "Calificado"
  | "En negociación"
  | "Cliente"
  | "Inactivo";

export type Source = "WhatsApp" | "Formulario web" | "Referido" | "Manual";

export const statusBadgeClass: Record<LeadStatus, string> = {
  "Nuevo": "bg-info/10 text-info border-info/20",
  "Contactado": "bg-warning/10 text-warning border-warning/20",
  "Calificado": "bg-purple-500/10 text-purple-500 border-purple-500/20 dark:text-purple-400",
  "En negociación": "bg-orange-500/10 text-orange-500 border-orange-500/20 dark:text-orange-400",
  "Cliente": "bg-success/10 text-success border-success/20",
  "Inactivo": "bg-muted text-muted-foreground border-border",
};

export const ALL_LEAD_STATUSES: LeadStatus[] = [
  "Nuevo",
  "Contactado",
  "Calificado",
  "En negociación",
  "Cliente",
  "Inactivo",
];

export const ALL_SOURCES: Source[] = ["WhatsApp", "Formulario web", "Referido", "Manual"];

export interface ContactStats {
  pipelineValue: number;
  probability: number;
  lastContactRelative: string;
  customerSince: string;
}