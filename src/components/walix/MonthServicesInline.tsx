import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronDown, ChevronRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useMonthlyServices,
  monthKey,
  SERVICE_STATUS_LABEL,
} from "@/lib/queries/monthlyServices";

/**
 * Lista compacta de los mantenimientos/recurrencias programados en el mes en curso,
 * agrupados por contacto único. Se muestra en "Mi Día" junto a los servicios de hoy.
 */
export function MonthServicesInline() {
  const month = monthKey(new Date());
  const { data: services = [], isLoading } = useMonthlyServices(month);
  const [open, setOpen] = useState(true);

  const contacts = useMemo(() => {
    const map = new Map<string, { id: string | null; name: string; count: number; statuses: string[] }>();
    services.forEach((s) => {
      const key = s.contact?.id ?? `x-${s.id}`;
      const e = map.get(key);
      const label = SERVICE_STATUS_LABEL[s.status] ?? s.status;
      if (e) { e.count++; e.statuses.push(label); }
      else map.set(key, { id: s.contact?.id ?? null, name: s.contact?.name ?? "Cliente sin nombre", count: 1, statuses: [label] });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [services]);

  if (isLoading || services.length === 0) return null;

  const monthLabel = new Date(month + "T00:00:00").toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-base capitalize">Mantenimientos de {monthLabel}</CardTitle>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {contacts.length} contactos · {services.length} servicios
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild className="text-xs">
            <Link to="/automations?tab=agenda">Agenda</Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-1 pt-0">
          {contacts.map((c) => (
            <div key={c.id ?? c.name} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
              {c.id ? (
                <Link to={`/contacts/${c.id}`} className="text-sm font-medium hover:underline truncate">
                  {c.name}
                </Link>
              ) : (
                <span className="text-sm font-medium truncate">{c.name}</span>
              )}
              <div className="flex shrink-0 items-center gap-1">
                {c.count > 1 && <span className="text-xs text-muted-foreground">{c.count}×</span>}
                <Badge variant="secondary" className="text-xs">{c.statuses[0]}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}