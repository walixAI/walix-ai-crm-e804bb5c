import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useReportsContext } from "@/lib/reports/context";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const INTENSITY_BG = [
  "bg-muted",
  "bg-success/10",
  "bg-success/30",
  "bg-success/60 text-white",
  "bg-success text-white",
] as const;

function totalForCell(c: { whatsapp: number; notes: number; dealsMoved: number }) {
  return c.whatsapp + c.notes + c.dealsMoved;
}

function intensity(total: number, max: number): number {
  if (total === 0) return 0;
  const ratio = total / Math.max(max, 1);
  if (ratio < 0.25) return 1;
  if (ratio < 0.5)  return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

export function TeamActivityHeatmap() {
  const { data, isLoading, users } = useReportsContext();

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <Skeleton className="h-48" />
      </div>
    );
  }

  const days = data.heatmapDays;
  const usersWithData = users.filter(u => data.heatmap[u.id]);

  if (usersWithData.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-semibold text-base mb-1">Actividad del equipo</h2>
        <p className="text-sm text-muted-foreground italic text-center py-8">Sin actividad registrada esta semana.</p>
      </div>
    );
  }

  const max = Math.max(
    1,
    ...usersWithData.flatMap(s => data.heatmap[s.id].map(totalForCell)),
  );

  const rowTotals: Record<string, number> = usersWithData.reduce((acc, s) => {
    acc[s.id] = data.heatmap[s.id].reduce((sum, c) => sum + totalForCell(c), 0);
    return acc;
  }, {} as Record<string, number>);

  const colTotals = days.map((_, di) =>
    usersWithData.reduce((sum, s) => sum + totalForCell(data.heatmap[s.id][di]), 0),
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4">
        <h2 className="font-semibold text-base">Actividad del equipo</h2>
        <p className="text-xs text-muted-foreground">Mensajes WA · notas · deals movidos por día</p>
      </div>

      <TooltipProvider delayDuration={150}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-left font-semibold text-muted-foreground px-1"></th>
                {days.map(d => (
                  <th key={d} className="text-center font-semibold text-muted-foreground px-1">{d}</th>
                ))}
                <th className="text-right font-semibold text-muted-foreground pl-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {usersWithData.map(s => (
                <tr key={s.id}>
                  <td className="font-medium pr-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-primary/10 text-primary grid place-items-center text-[9px] font-bold">
                        {s.initials}
                      </span>
                      {s.name}
                    </span>
                  </td>
                  {data.heatmap[s.id].map((cell, di) => {
                    const total = totalForCell(cell);
                    const lvl = intensity(total, max);
                    return (
                      <td key={di} className="p-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={cn(
                              "h-9 rounded-md grid place-items-center font-semibold cursor-default",
                              INTENSITY_BG[lvl],
                            )}>
                              {total > 0 ? total : ""}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-0.5">
                              <div className="font-semibold">{s.name} · {days[di]}</div>
                              <div>WhatsApp: {cell.whatsapp}</div>
                              <div>Notas: {cell.notes}</div>
                              <div>Oportunidades movidas: {cell.dealsMoved}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                  <td className="text-right pl-2 font-bold tabular-nums">{rowTotals[s.id]}</td>
                </tr>
              ))}
              <tr>
                <td className="font-semibold text-muted-foreground pt-2">Total</td>
                {colTotals.map((t, i) => (
                  <td key={i} className="text-center font-bold tabular-nums pt-2">{t}</td>
                ))}
                <td className="text-right font-bold tabular-nums pt-2 pl-2">
                  {colTotals.reduce((a, b) => a + b, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </TooltipProvider>
    </div>
  );
}
