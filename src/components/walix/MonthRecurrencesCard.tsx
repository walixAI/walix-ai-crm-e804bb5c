import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Repeat, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useMonthlyServices,
  monthKey,
  SERVICE_STATUS_LABEL,
  type MonthlyService,
} from "@/lib/queries/monthlyServices";

const DONE = new Set(["executed", "skipped"]);

/**
 * Widget de "Mi Día": recurrencias programadas en el mes en curso,
 * agrupadas por definición de recurrencia (Mantenimiento 6M, Cambio de filtro, etc.).
 */
export function MonthRecurrencesCard() {
  const month = monthKey(new Date());
  const { data: services = [], isLoading } = useMonthlyServices(month);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: MonthlyService[] }>();
    services.forEach((s) => {
      const key = s.recurrence_id ?? "sin-recurrencia";
      const name = s.recurrence?.name ?? "Recurrencia sin nombre";
      const g = map.get(key) ?? { name, items: [] };
      g.items.push(s);
      map.set(key, g);
    });
    return [...map.entries()]
      .map(([id, g]) => ({
        id,
        name: g.name,
        total: g.items.length,
        done: g.items.filter((i) => DONE.has(i.status)).length,
        items: [...g.items].sort((a, b) => a.due_date.localeCompare(b.due_date)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [services]);

  const monthLabel = new Date(month + "T00:00:00").toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Repeat className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-base capitalize">Recurrencias de {monthLabel}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {services.length} programadas · {services.filter((s) => DONE.has(s.status)).length} cerradas
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-xs">
          <Link to="/automations?tab=agenda">Ver agenda</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay recurrencias programadas este mes.</p>
        )}
        {groups.map((g) => {
          const open = openGroups[g.id] ?? false;
          return (
            <div key={g.id} className="rounded-lg border">
              <button
                type="button"
                onClick={() => setOpenGroups((o) => ({ ...o, [g.id]: !open }))}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/60"
              >
                <span className="flex items-center gap-2 text-sm font-medium truncate">
                  {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  {g.name}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary">{g.total}</Badge>
                  <span className="text-xs text-muted-foreground">{g.done}/{g.total} cerradas</span>
                </span>
              </button>
              {open && (
                <div className="border-t px-3 py-1">
                  {g.items.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 py-1.5">
                      {s.contact?.id ? (
                        <Link to={`/contacts/${s.contact.id}`} className="truncate text-sm hover:underline">
                          {s.contact.name}
                        </Link>
                      ) : (
                        <span className="truncate text-sm">{s.contact?.name ?? "Cliente sin nombre"}</span>
                      )}
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(s.due_date + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                        </span>
                        <Badge variant={DONE.has(s.status) ? "secondary" : "outline"} className="text-[11px]">
                          {SERVICE_STATUS_LABEL[s.status] ?? s.status}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
