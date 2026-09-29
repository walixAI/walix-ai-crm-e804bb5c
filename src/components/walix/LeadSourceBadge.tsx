import { Globe, MessageCircle, FileText, Megaphone, User } from "lucide-react";
import { cn } from "@/lib/utils";

/** Normaliza cualquier valor de origen (deal.source, contact.source, attribution.source_kind) a una etiqueta legible. */
export function leadOriginLabel(src?: string | null): string {
  const s = (src ?? "").toLowerCase();
  if (!s) return "Manual";
  if (s.includes("whatsapp_ad") || s.includes("whatsapp (anuncio)")) return "WhatsApp (anuncio)";
  if (s.includes("whatsapp")) return "WhatsApp";
  if (s.includes("meta") || s.includes("formulario meta")) return "Formulario Meta";
  if (s === "web" || s.includes("sitio web") || s.includes("formulario web")) return "Sitio web";
  if (s.includes("referido")) return "Referido";
  return src ?? "Manual";
}

export const LEAD_ORIGINS = ["WhatsApp (anuncio)", "WhatsApp", "Formulario Meta", "Sitio web", "Referido", "Manual"];

const ICONS: Record<string, any> = {
  "WhatsApp (anuncio)": Megaphone,
  WhatsApp: MessageCircle,
  "Formulario Meta": FileText,
  "Sitio web": Globe,
};

export function LeadSourceBadge({ source, className }: { source?: string | null; className?: string }) {
  const label = leadOriginLabel(source);
  const Icon = ICONS[label] ?? User;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground whitespace-nowrap", className)}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}
