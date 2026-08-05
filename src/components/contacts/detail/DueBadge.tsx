import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Días de diferencia entre hoy y una fecha (YYYY-MM-DD o ISO), a medianoche local. */
function daysFromToday(iso: string) {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const n = new Date();
  const b = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function formatDueLabel(iso: string) {
  const diff = daysFromToday(iso);
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  const fecha = d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
  if (diff < 0) return { fecha, rel: `vencido hace ${Math.abs(diff)} d`, tone: "danger" as const };
  if (diff === 0) return { fecha, rel: "hoy", tone: "danger" as const };
  if (diff === 1) return { fecha, rel: "mañana", tone: "warn" as const };
  if (diff <= 14) return { fecha, rel: `en ${diff} días`, tone: "warn" as const };
  return { fecha, rel: `en ${diff} días`, tone: "muted" as const };
}

interface Props {
  date: string | null | undefined;
  label?: string;
  className?: string;
}

/** Chip con la fecha programada del servicio/oportunidad y su urgencia. */
export function DueBadge({ date, label = "Programado", className }: Props) {
  if (!date) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-[10px] text-muted-foreground italic", className)}>
        <CalendarClock className="h-3 w-3" /> Sin fecha programada
      </span>
    );
  }
  const { fecha, rel, tone } = formatDueLabel(date);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
        tone === "danger" && "border-destructive/30 bg-destructive/10 text-destructive",
        tone === "warn" && "border-warning/30 bg-warning/10 text-warning",
        tone === "muted" && "border-border bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <CalendarClock className="h-3 w-3 shrink-0" />
      {label}: {fecha} · {rel}
    </span>
  );
}
