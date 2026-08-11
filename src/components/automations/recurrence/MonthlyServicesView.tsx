import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays, Phone, CheckCircle2, Users, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useMonthlyServices, useServiceTransition, monthKey,
  SERVICE_STATUS_LABEL, type MonthlyService, type ServiceStatus,
} from "@/lib/queries/monthlyServices";

const STATUS_STYLE: Record<ServiceStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  price_accepted: "bg-primary/10 text-primary",
  scheduled: "bg-accent text-accent-foreground",
  executed: "bg-success/15 text-success",
  postponed: "bg-warning/15 text-warning",
  skipped: "bg-destructive/10 text-destructive",
};

const FILTERS: Array<{ value: "all" | ServiceStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Por contactar" },
  { value: "price_accepted", label: "Precio aceptado" },
  { value: "scheduled", label: "Agendados" },
  { value: "executed", label: "Ejecutados" },
];

const monthLabel = (m: string) =>
  new Date(m + "T00:00:00").toLocaleDateString("es-MX", { month: "long", year: "numeric" });

export function MonthlyServicesView() {
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<"all" | ServiceStatus>("all");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"services" | "contacts">("services");
  const [target, setTarget] = useState<MonthlyService | null>(null);

  const month = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return monthKey(d);
  }, [offset]);

  const { data: services = [], isLoading } = useMonthlyServices(month);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: services.length };
    services.forEach((s) => { c[s.status] = (c[s.status] ?? 0) + 1; });
    return c;
  }, [services]);

  const filtered = services.filter((s) => {
    if (filter !== "all" && s.status !== filter) return false;
    if (search && !(s.contact?.name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Contactos únicos con al menos un servicio en el mes (según el filtro activo)
  const uniqueContacts = useMemo(() => {
    const map = new Map<string, { id: string | null; name: string; phone: string | null; items: MonthlyService[] }>();
    filtered.forEach((s) => {
      const key = s.contact?.id ?? `sin-contacto-${s.id}`;
      const entry = map.get(key);
      if (entry) entry.items.push(s);
      else
        map.set(key, {
          id: s.contact?.id ?? null,
          name: s.contact?.name ?? "Cliente sin nombre",
          phone: s.contact?.phone ?? null,
          items: [s],
        });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [filtered]);

  const exportCsv = () => {
    const rows = [
      ["Contacto", "Teléfono", "Servicios", "Estatus", "Fecha programada"],
      ...uniqueContacts.map((c) => [
        c.name,
        c.phone ?? "",
        String(c.items.length),
        c.items.map((i) => SERVICE_STATUS_LABEL[i.status] ?? i.status).join(" | "),
        c.items.map((i) => i.due_date).join(" | "),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `mantenimientos-${month.slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[170px] text-center">
            <p className="font-semibold capitalize">{monthLabel(month)}</p>
            <p className="text-xs text-muted-foreground">
              {services.length} servicios · {uniqueContacts.length} contactos
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {offset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>Hoy</Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-56"
          />
          <Button
            variant={mode === "contacts" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode((m) => (m === "contacts" ? "services" : "contacts"))}
          >
            <Users className="mr-2 h-4 w-4" />
            Contactos únicos ({uniqueContacts.length})
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!uniqueContacts.length}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList className="flex-wrap h-auto">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label} ({counts[f.value] ?? 0})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No hay servicios en este mes con ese filtro.
        </Card>
      ) : mode === "contacts" ? (
        <div className="space-y-2">
          {uniqueContacts.map((c) => (
            <Card key={c.id ?? c.name} className="p-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                {c.id ? (
                  <Link to={`/contacts/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                ) : (
                  <span className="font-medium">{c.name}</span>
                )}
                <p className="text-xs text-muted-foreground truncate">
                  {c.items.length} servicio{c.items.length > 1 ? "s" : ""} · {c.items.map((i) => i.recurrence?.name).filter(Boolean).join(", ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {c.items.map((i) => (
                  <Badge key={i.id} className={STATUS_STYLE[i.status] ?? ""} variant="secondary">
                    {SERVICE_STATUS_LABEL[i.status] ?? i.status}
                  </Badge>
                ))}
              </div>
              {c.phone && (
                <Button asChild variant="ghost" size="icon" title="Llamar">
                  <a href={`tel:${c.phone}`}><Phone className="h-4 w-4" /></a>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setTarget(c.items[0])}>
                Actualizar
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Card key={s.id} className="p-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                {s.contact ? (
                  <Link to={`/contacts/${s.contact.id}`} className="font-medium hover:underline">
                    {s.contact.name}
                  </Link>
                ) : (
                  <span className="font-medium">Cliente sin nombre</span>
                )}
                <p className="text-xs text-muted-foreground truncate">
                  {s.recurrence?.name}
                  {s.scheduled_at && ` · ${new Date(s.scheduled_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`}
                  {s.price_quoted != null && ` · $${Number(s.price_quoted).toLocaleString("es-MX")}`}
                </p>
              </div>
              <Badge className={STATUS_STYLE[s.status] ?? ""} variant="secondary">
                {SERVICE_STATUS_LABEL[s.status] ?? s.status}
              </Badge>
              {s.contact?.phone && (
                <Button asChild variant="ghost" size="icon" title="Llamar">
                  <a href={`tel:${s.contact.phone}`}><Phone className="h-4 w-4" /></a>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setTarget(s)}>
                Actualizar
              </Button>
            </Card>
          ))}
        </div>
      )}

      <ServiceUpdateDialog service={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function ServiceUpdateDialog({ service, onClose }: { service: MonthlyService | null; onClose: () => void }) {
  const { toast } = useToast();
  const transition = useServiceTransition();
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  const run = async (status: ServiceStatus) => {
    if (!service) return;
    if (status === "scheduled" && !date) {
      toast({ title: "Elige el día del servicio", variant: "destructive" });
      return;
    }
    try {
      await transition.mutateAsync({
        service,
        status,
        price_quoted: price ? Number(price) : undefined,
        scheduled_at: date ? new Date(date + "T09:00:00").toISOString() : undefined,
        notes: notes || undefined,
      });
      toast({ title: "Servicio actualizado" });
      setPrice(""); setDate(""); setNotes("");
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "", variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!service} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{service?.recurrence?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{service?.contact?.name}</p>
          <div className="space-y-1.5">
            <Label>Precio acordado (MXN)</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>Día del servicio</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto" disabled={transition.isPending} onClick={() => run("price_accepted")}>
            Precio aceptado
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" disabled={transition.isPending} onClick={() => run("scheduled")}>
            <CalendarDays className="h-4 w-4 mr-1.5" /> Agendar
          </Button>
          <Button className="w-full sm:w-auto" disabled={transition.isPending} onClick={() => run("executed")}>
            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Ejecutado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
