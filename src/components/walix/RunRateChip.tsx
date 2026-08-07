import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRunRate, formatMXN0 } from "@/lib/queries/runRate";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "react-router-dom";

const TONE: Record<string, string> = {
  green: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30",
  yellow: "text-amber-600 bg-amber-500/10 border-amber-500/30",
  red: "text-red-600 bg-red-500/10 border-red-500/30",
};

export function RunRateChip() {
  const { data } = useRunRate();
  if (!data || data.monthGoal <= 0) return null;
  const tone = TONE[data.status];
  const fmt = (n: number) =>
    data.metric === "count" ? `${Math.round(n).toLocaleString("es-MX")} ventas` : formatMXN0(n);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold hover:opacity-90 transition", tone)}>
          <TrendingUp className="h-3.5 w-3.5" />
          Run Rate {Math.round(data.runRatePct)}%
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2" align="end">
        <div className="text-sm font-semibold">Run Rate del mes</div>
        <div className="text-xs text-muted-foreground">Día {data.daysElapsed} de {data.daysTotal} {data.countBusinessDays ? "hábiles" : "corridos"}</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Row label={data.metric === "count" ? "Ventas cerradas" : "Vendido"} value={fmt(data.sold)} />
          <Row label="Esperado hoy" value={fmt(data.expectedToday)} />
          <Row label="Meta" value={fmt(data.monthGoal)} />
          <Row label="Proyección" value={fmt(data.projection)} />
        </div>
        {data.recommendations[0] && (
          <div className="text-xs bg-muted/50 rounded p-2">{data.recommendations[0]}</div>
        )}
        <Link to="/mi-dia" className="text-xs text-primary hover:underline">Ver detalle en Mi Día →</Link>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}