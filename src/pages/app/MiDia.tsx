import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, CheckCircle2, ClipboardList, DollarSign, FileText, Plus, Sparkles, Wrench, MessageCircle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useMiDiaData, useQuickCreateTask, useSetSimpleMode, type JumboItem } from "@/lib/queries/miDia";
import { QuickTaskDialog } from "@/components/miDia/QuickTaskDialog";
import { useTenant } from "@/lib/queries/tenant";
import { useToggleTask } from "@/lib/queries/tasks";

export default function MiDia() {
  const { data, isLoading } = useMiDiaData();
  const { data: tenant } = useTenant();
  const [dialogOpen, setDialogOpen] = useState<null | { kind: string }>(null);
  const setMode = useSetSimpleMode();
  const toggleTask = useToggleTask();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  const totals = data?.totals;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{format(new Date(), "EEEE d 'de' MMMM", { locale: es })}</div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {greeting} <span className="text-primary">{tenant?.brandName ?? "en Walix"}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="lg" asChild>
              <Link to="/whatsapp"><MessageCircle className="mr-2 h-5 w-5" /> WhatsApp</Link>
            </Button>
            <Button variant="ghost" size="icon" title="Volver al modo estándar"
              onClick={async () => { await setMode.mutateAsync(false); window.location.href = "/dashboard"; }}>
              <Settings2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {totals && (
          <div className="max-w-6xl mx-auto px-6 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryChip icon={ClipboardList} label="Tareas hoy" value={totals.tasks} tone="primary" />
            <SummaryChip icon={DollarSign} label="Por cobrar" value={totals.collect} sub={`$${totals.collectAmount.toLocaleString("es-MX")}`} tone="accent" />
            <SummaryChip icon={FileText} label="Por cotizar" value={totals.quote} tone="warning" />
            <SummaryChip icon={Wrench} label="Servicios hoy" value={totals.services} tone="info" />
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {isLoading && <div className="text-center text-muted-foreground py-12">Cargando tu día…</div>}

        {!isLoading && (
          <>
            <JumboColumn title="Cobrar hoy" description="Deals con pago pendiente que vencen hoy o antes." icon={DollarSign} items={data?.collect ?? []} emptyText="No hay cobros programados." />
            <JumboColumn title="Cotizar" description="Oportunidades esperando tu cotización." icon={FileText} items={data?.quote ?? []} emptyText="No tienes cotizaciones pendientes." />
            <JumboColumn title="Servicios de hoy" description="Mantenimientos e instalaciones agendadas." icon={Wrench} items={data?.services ?? []} emptyText="No hay servicios agendados hoy." />
            <JumboColumn title="Seguimiento" description="Clientes en negociación." icon={Sparkles} items={data?.followup ?? []} emptyText="Sin seguimientos activos." />
            <JumboColumn
              title="Mis tareas de hoy"
              description="Pendientes tuyos para el día."
              icon={ClipboardList}
              items={data?.tasks ?? []}
              emptyText="¡Estás al día!"
              onToggle={(id) => toggleTask.mutate({ id, completed: true }, { onSuccess: () => toast.success("Tarea completada") })}
            />
          </>
        )}
      </main>

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button size="lg" className="h-16 rounded-full shadow-2xl px-8 text-lg gap-3"
          onClick={() => setDialogOpen({ kind: "task" })}>
          <Plus className="h-6 w-6" /> Registrar
        </Button>
      </div>

      <QuickTaskDialog open={!!dialogOpen} onOpenChange={(o) => !o && setDialogOpen(null)} />
    </div>
  );
}

function SummaryChip({ icon: Icon, label, value, sub, tone }: any) {
  const bg =
    tone === "primary" ? "bg-primary/10 text-primary" :
    tone === "accent"  ? "bg-emerald-500/10 text-emerald-600" :
    tone === "warning" ? "bg-amber-500/10 text-amber-600" :
                         "bg-sky-500/10 text-sky-600";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <div className={`h-12 w-12 rounded-xl grid place-items-center ${bg}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-3xl font-bold leading-none">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {sub && <div className="text-xs text-muted-foreground/80 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

interface JumboColumnProps {
  title: string;
  description: string;
  icon: any;
  items: JumboItem[];
  emptyText: string;
  onToggle?: (id: string) => void;
}

function JumboColumn({ title, description, icon: Icon, items, emptyText, onToggle }: JumboColumnProps) {
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-2xl">
          <Icon className="h-7 w-7 text-primary" />
          {title}
          <span className="ml-auto text-base font-normal text-muted-foreground">{items.length}</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && (
          <div className="text-center text-muted-foreground py-6 text-lg">{emptyText}</div>
        )}
        {items.map(i => (
          <div key={`${i.kind}-${i.id}`}
            className={`flex items-center gap-4 rounded-xl border p-4 hover:bg-muted/40 transition-colors
              ${i.overdue ? "border-destructive/60 bg-destructive/5" : "border-border"}`}>
            {onToggle && i.kind === "task" && (
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0"
                onClick={() => onToggle(i.id)}>
                <CheckCircle2 className="h-7 w-7" />
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold truncate">{i.title}</div>
              {i.subtitle && <div className="text-sm text-muted-foreground truncate">{i.subtitle}</div>}
              {i.dueAt && (
                <div className={`text-xs mt-1 ${i.overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                  {i.overdue && <AlertCircle className="inline h-3 w-3 mr-1" />}
                  {format(new Date(i.dueAt), "PPp", { locale: es })}
                </div>
              )}
            </div>
            {i.amount != null && (
              <div className="text-right">
                <div className="text-xl font-bold">${i.amount.toLocaleString("es-MX")}</div>
              </div>
            )}
            {i.contactId && (
              <Button variant="outline" size="sm" asChild>
                <Link to={
                  i.kind === "task"
                    ? `/contacts/${i.contactId}?focus=task&taskId=${i.id}`
                    : `/contacts/${i.contactId}`
                }>Ver</Link>
              </Button>
            )}
            {i.dealId && !i.contactId && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/pipeline">Ver</Link>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}