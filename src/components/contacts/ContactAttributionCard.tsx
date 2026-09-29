import { useQuery } from "@tanstack/react-query";
import { Globe2, MapPin, Monitor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { LeadSourceBadge } from "@/components/walix/LeadSourceBadge";

interface Props { contactId: string }

const GROUPS: { title: string; fields: [string, string][] }[] = [
  { title: "Campaña (UTMs)", fields: [
    ["utm_source", "utm_source"], ["utm_medium", "utm_medium"], ["utm_campaign", "utm_campaign"],
    ["utm_adgroup", "Conjunto / grupo de anuncios"], ["utm_term", "utm_term"], ["utm_content", "utm_content"],
    ["utm_id", "utm_id"], ["ga_channel", "Canal"],
    ["ad_campaign_name", "Nombre de campaña"], ["ad_group_name", "Nombre del conjunto / grupo"], ["ad_name", "Nombre del anuncio"],
  ]},
  { title: "Google Ads", fields: [
    ["google_campaign_id", "Campaña (ID)"], ["google_adgroup_id", "Grupo de anuncios (ID)"], ["google_creative_id", "Anuncio (ID)"],
    ["google_keyword", "Palabra clave"], ["google_matchtype", "Concordancia"], ["google_network", "Red"],
    ["google_placement", "Ubicación (placement)"], ["google_device", "Dispositivo"], ["google_devicemodel", "Modelo"],
    ["google_adposition", "Posición"], ["google_target_id", "Segmentación (ID)"], ["google_loc_physical", "Ubicación física (ID)"],
    ["google_loc_interest", "Ubicación de interés (ID)"], ["google_feed_item_id", "Extensión (ID)"],
    ["gclid", "gclid"], ["wbraid", "wbraid"], ["gbraid", "gbraid"], ["msclkid", "msclkid"],
  ]},
  { title: "Meta Ads", fields: [
    ["meta_platform", "Plataforma"], ["meta_placement", "Ubicación (placement)"], ["meta_site_source", "Sitio"],
    ["meta_campaign_id", "Campaña (ID)"], ["meta_adset_id", "Conjunto (ID)"], ["meta_ad_id", "Anuncio (ID)"],
    ["meta_form_name", "Formulario"], ["meta_form_id", "Formulario (ID)"], ["meta_lead_id", "Lead (ID)"],
    ["meta_page_id", "Página (ID)"], ["meta_is_organic", "Orgánico"], ["meta_created_time", "Fecha en Meta"],
    ["fbclid", "fbclid / ctwa_clid"],
  ]},
  { title: "Visita", fields: [
    ["landing_url", "Página de entrada"], ["referrer", "Referente"], ["language", "Idioma"], ["ip_address", "IP"],
  ]},
];

const show = (v: unknown) => typeof v === "boolean" ? (v ? "Sí" : "No") : String(v);

export function ContactAttributionCard({ contactId }: Props) {
  const { data } = useQuery({
    queryKey: ["contact-attribution", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_attribution").select("*").eq("contact_id", contactId);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      return { first: rows.find((r) => r.touch_type === "first"), last: rows.find((r) => r.touch_type === "last") };
    },
  });

  const first = data?.first;
  const last = data?.last;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Origen y rastreo</span>
      </div>
      {!first && !last ? (
        <div className="px-4 py-3 text-xs text-muted-foreground">Sin datos de origen. Se registró manualmente.</div>
      ) : (
        <div className="px-4 py-3 space-y-3 text-xs">
          <div className="flex flex-wrap gap-1.5 items-center">
            <LeadSourceBadge source={(first ?? last)?.source_kind} />
            {first?.touch_count > 1 && <span className="text-muted-foreground">{first.touch_count} visitas</span>}
          </div>
          <Touch title="Primer contacto" row={first} />
          {last && first && last.touched_at !== first.touched_at && <Touch title="Último contacto" row={last} />}
        </div>
      )}
    </div>
  );
}

function Touch({ title, row }: { title: string; row: any }) {
  if (!row) return null;
  return (
    <div className="space-y-1">
      <div className="flex justify-between font-medium">
        <span>{title}</span>
        <span className="text-muted-foreground">{row.touched_at ? format(new Date(row.touched_at), "dd/MM/yy HH:mm") : ""}</span>
      </div>
      {GROUPS.map((g) => {
        const present = g.fields.filter(([k]) => row[k] != null && row[k] !== "");
        if (!present.length) return null;
        return (
          <div key={g.title} className="pt-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">{g.title}</div>
            {present.map(([k, label]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className="text-right truncate" title={show(row[k])}>{show(row[k])}</span>
              </div>
            ))}
          </div>
        );
      })}
      {row.extra?.form_fields && Object.keys(row.extra.form_fields).length > 0 && (
        <div className="pt-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Respuestas del formulario</div>
          {Object.entries(row.extra.form_fields as Record<string, string>).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="text-muted-foreground shrink-0">{k}</span>
              <span className="text-right truncate" title={String(v)}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}
      {(row.city || row.region || row.country) && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3 w-3" />{[row.city, row.region, row.country, row.postal_code].filter(Boolean).join(", ")}
        </div>
      )}
      {(row.device_type || row.os || row.browser) && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Monitor className="h-3 w-3" />{[row.device_type, row.os, row.browser].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}
