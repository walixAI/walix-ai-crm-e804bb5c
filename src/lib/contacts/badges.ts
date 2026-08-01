export type ContactLifecycle =
  | "prospecto"
  | "cliente"
  | "cliente_inactivo"
  | "inactivo";

export type Source = "WhatsApp" | "Formulario web" | "Referido" | "Manual";

export const statusBadgeClass: Record<ContactLifecycle, string> = {
  prospecto: "bg-info/10 text-info border-info/20",
  cliente: "bg-success/10 text-success border-success/20",
  cliente_inactivo: "bg-warning/10 text-warning border-warning/20",
  inactivo: "bg-muted text-muted-foreground border-border",
};

export const lifecycleLabel: Record<ContactLifecycle, string> = {
  prospecto: "Prospecto",
  cliente: "Cliente",
  cliente_inactivo: "Cliente ya inactivo",
  inactivo: "Inactivo",
};

export const ALL_CONTACT_LIFECYCLES: ContactLifecycle[] = [
  "prospecto",
  "cliente",
  "cliente_inactivo",
  "inactivo",
];

export const ALL_SOURCES: Source[] = ["WhatsApp", "Formulario web", "Referido", "Manual"];

export interface ContactStats {
  pipelineValue: number;
  probability: number;
  lastContactRelative: string;
  customerSince: string;
}
