import { useQuery } from "@tanstack/react-query";
import { Globe2, MapPin, Monitor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { LeadSourceBadge } from "@/components/walix/LeadSourceBadge";

interface Props { contactId: string }

const FIELDS: [string, string][] = [
  ["utm_source", "utm_source"],
  ["utm_medium", "utm_medium"],
  ["utm_campaign", "utm_campaign"],
  ["utm_content", "utm_content"],
  ["utm_term", "utm_term"],
  ["ga_channel", "Canal"],
  ["meta_platform", "Plataforma Meta"],
  ["meta_campaign_id", "Campaña Meta (ID)"],
  ["meta_adset_id", "Conjunto (ID)"],
  ["meta_ad_id", "Anuncio (ID)"],
  ["meta_form_id", "Formulario (ID)"],
  ["gclid", "gclid"],
  ["fbclid", "fbclid / ctwa_clid"],
  ["msclkid", "msclkid"],
  ["landing_url", "Página de entrada"],
  ["referrer", "Referente"],
  ["language", "Idioma"],
  ["ip_address", "IP"],
];

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
      {FIELDS.map(([k, label]) => row[k] ? (
        <div key={k} className="flex justify-between gap-2">
          <span className="text-muted-foreground shrink-0">{label}</span>
          <span className="text-right truncate" title={String(row[k])}>{String(row[k])}</span>
        </div>
      ) : null)}
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
