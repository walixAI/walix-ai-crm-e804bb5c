import { Link } from "react-router-dom";
import { CalendarClock, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMonthlyServices, monthKey, SERVICE_STATUS_LABEL } from "@/lib/queries/monthlyServices";

/** Mantenimientos y cambios de filtro programados para el mes en curso. */
export function MonthServicesCard() {
  const month = monthKey(new Date());
  const { data: services = [], isLoading } = useMonthlyServices(month);

  const pending = services.filter((s) => s.status === "pending" || s.status === "price_accepted");
  const scheduled = services.filter((s) => s.status === "scheduled");
  const done = services.filter((s) => s.status === "executed");

  if (isLoading || services.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" />
          Servicios de este mes
        </CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to="/automations">Ver agenda <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">{pending.length} por contactar</Badge>
          <Badge variant="secondary">{scheduled.length} agendados</Badge>
          <Badge variant="secondary">{done.length} ejecutados</Badge>
        </div>
        <div className="space-y-1.5">
          {pending.slice(0, 5).map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <Link
                to={s.contact ? `/contacts/${s.contact.id}` : "#"}
                className="truncate hover:underline"
              >
                {s.contact?.name ?? "Cliente"} · <span className="text-muted-foreground">{s.recurrence?.name}</span>
              </Link>
              <span className="text-xs text-muted-foreground shrink-0">
                {SERVICE_STATUS_LABEL[s.status]}
              </span>
            </div>
          ))}
          {pending.length > 5 && (
            <p className="text-xs text-muted-foreground">+{pending.length - 5} más…</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
