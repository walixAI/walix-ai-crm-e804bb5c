import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hangupLabel, type HangupEvidence } from "../../../supabase/functions/_shared/call-hangup";

export function CallHangupDetails({ hangup_by, hangup_at, userId }: HangupEvidence & { userId?: string | null }) {
  const { data: userName } = useQuery({
    queryKey: ["profile-name", userId],
    enabled: hangup_by === "agent" && !!userId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", userId!).maybeSingle();
      return data?.full_name ?? null;
    },
  });
  const date = hangup_at ? new Date(hangup_at) : null;
  const validDate = date && Number.isFinite(date.getTime()) ? date : null;
  const label = hangup_by === "agent" && userName ? `Colgó user: ${userName}` : hangupLabel(hangup_by);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>Quién colgó: {label}</span>
      {validDate && <time dateTime={validDate.toISOString()}>{validDate.toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}</time>}
    </span>
  );
}
