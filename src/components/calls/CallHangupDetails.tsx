import { hangupLabel, type HangupEvidence } from "../../../supabase/functions/_shared/call-hangup";

export function CallHangupDetails({ hangup_by, hangup_at }: HangupEvidence) {
  const date = hangup_at ? new Date(hangup_at) : null;
  const validDate = date && Number.isFinite(date.getTime()) ? date : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>Quién colgó: {hangupLabel(hangup_by)}</span>
      {validDate && <time dateTime={validDate.toISOString()}>{validDate.toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}</time>}
    </span>
  );
}