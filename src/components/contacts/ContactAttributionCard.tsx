import { useQuery } from "@tanstack/react-query";
import { Globe2, MapPin, Monitor, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Props {
  contactId: string;
}

export function ContactAttributionCard({ contactId }: Props) {
  const { data } = useQuery({
    queryKey: ["contact-attribution", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_attribution")
        .select("*")
        .eq("contact_id", contactId);
      if (error) throw error;
      const rows = data ?? [];
      return {
        first: rows.find((r: any) => r.touch_type === "first") as any,
        last: rows.find((r: any) => r.touch_type === "last") as any,
      };
    },
  });

  const first = data?.first;
  const last = data?.last;
  if (!first && !last) return null;
  const main = first ?? last;

  const row = (label: string, value?: string | null) =>
    value ? (
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-right truncate">{value}</span>
      </div>
    ) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe2 className="h-4 w-4" /> Origen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {main?.ga_channel && <Badge variant="secondary">{main.ga_channel}</Badge>}
          {main?.source_kind && <Badge variant="outline">{main.source_kind}</Badge>}
          {main?.utm_campaign && <Badge variant="outline"><Tag className="h-3 w-3 mr-1" />{main.utm_campaign}</Badge>}
        </div>

        <div className="space-y-1">
          {row("Primer contacto", first?.touched_at ? format(new Date(first.touched_at), "dd/MM/yy HH:mm") : null)}
          {row("Último contacto", last?.touched_at ? format(new Date(last.touched_at), "dd/MM/yy HH:mm") : null)}
          {row("utm_source", main?.utm_source)}
          {row("utm_medium", main?.utm_medium)}
          {row("utm_content", main?.utm_content)}
          {row("Página de entrada", main?.landing_path)}
          {row("Referente", main?.referrer)}
          {row("Anuncio (Meta)", main?.meta_ad_id)}
        </div>

        {(main?.city || main?.region || main?.country) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {[main.city, main.region, main.country].filter(Boolean).join(", ")}
          </div>
        )}
        {(main?.device_type || main?.os || main?.browser) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Monitor className="h-3.5 w-3.5" />
            {[main.device_type, main.os, main.browser].filter(Boolean).join(" · ")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
