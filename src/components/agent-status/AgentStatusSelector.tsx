import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAgentReasons, useAgentStatus } from "@/hooks/useAgentStatus";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";

export const kindDot = (k?: string) => k === "available" ? "bg-success" : k === "pause" ? "bg-warning" : k === "on_call" ? "bg-destructive" : "bg-muted-foreground";
export const elapsed = (since?: string | null, now = Date.now()) => {
  if (!since) return "";
  const m = Math.max(0, Math.floor((now - Date.parse(since)) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

export function AgentStatusSelector() {
  const { data: reasons = [] } = useAgentReasons();
  const { status, change } = useAgentStatus();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  if (!reasons.length) return null;
  const current = reasons.find((r) => r.id === status?.reason_id);
  const max = current?.max_minutes;
  const over = !!(max && status?.since && now - Date.parse(status.since) > max * 60000);
  const pick = (id: string) => change.mutate({ reasonId: id }, { onError: (e: any) => toastError("No se pudo cambiar el estado", e.message) });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="Mi estado" className={cn("shrink-0 inline-flex items-center gap-2 h-9 rounded-full border border-border bg-background px-3 text-xs font-medium hover:border-primary/40", over && "border-warning text-warning")}>
          <span className={cn("h-2.5 w-2.5 rounded-full", kindDot(status?.kind))} />
          <span className="hidden sm:inline max-w-[120px] truncate">{status?.reason_name ?? "Desconectado"}</span>
          {status?.since && <span className="hidden md:inline tabular-nums text-muted-foreground">{elapsed(status.since, now)}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Mi estado para recibir llamadas</DropdownMenuLabel>
        {over && <div className="px-2 pb-1 text-xs text-warning">Tu pausa superó {max} min</div>}
        <DropdownMenuSeparator />
        {reasons.map((r) => (
          <DropdownMenuItem key={r.id} onClick={() => pick(r.id)} className="gap-2">
            <span className={cn("h-2 w-2 rounded-full", kindDot(r.kind))} />
            <span className="flex-1">{r.kind === "pause" ? `Pausa: ${r.name}` : r.name}</span>
            {r.max_minutes ? <span className="text-xs text-muted-foreground">{r.max_minutes} min</span> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">Solo en «Disponible» te suenan llamadas. En pausa sigues viendo los avisos.</div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
