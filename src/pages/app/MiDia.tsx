import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, DollarSign, FileText, Plus, Sparkles, TrendingUp, Trophy, PiggyBank, Wrench, MessageCircle, Settings2, Receipt } from "lucide-react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useMiDiaData, useQuickCreateTask, useSetSimpleMode, type JumboItem } from "@/lib/queries/miDia";
import { QuickTaskDialog } from "@/components/miDia/QuickTaskDialog";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { CloseTaskDialog } from "@/components/contacts/simple/CloseTaskDialog";
import { RegisterPaymentDialog } from "@/components/miDia/RegisterPaymentDialog";
import { RescheduleCollectionDialog } from "@/components/miDia/RescheduleCollectionDialog";
import { useMyProfile } from "@/lib/queries/profile";
import { useToggleTask } from "@/lib/queries/tasks";
import { RunRateCard } from "@/components/walix/RunRateCard";
import { ProfitabilityCard } from "@/components/walix/ProfitabilityCard";
import { useRunRate, formatMXN0 } from "@/lib/queries/runRate";
import { useMonthProfitability } from "@/lib/queries/expenses";
import { cn } from "@/lib/utils";
import { LayoutRenderer, Widget } from "@/components/walix/widgets/LayoutRenderer";
import { CustomizeSheet } from "@/components/walix/widgets/CustomizeSheet";
import { blockWhatsappAction, useWhatsappChatEnabled, WHATSAPP_DISABLED_REASON } from "@/lib/whatsapp/featureFlags";

type ExpandKey = "runrate" | "profit" | "won" | null;
type ColumnKey = "tasks" | "collect" | "quote" | "services";

export default function MiDia() {
  const WHATSAPP_CHAT_ENABLED = useWhatsappChatEnabled();
  const { data, isLoading } = useMiDiaData();
  const { data: profile } = useMyProfile();
  const [dialogOpen, setDialogOpen] = useState<null | { kind: string }>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [closingTask, setClosingTask] = useState<{ id: string; title: string; contactId: string; taskKind: string | null; dueAt: string | null } | null>(null);
  const [payingDeal, setPayingDeal] = useState<{ id: string; title: string; amount: number } | null>(null);
  const [reschedDeal, setReschedDeal] = useState<{ id: string; title: string; currentDate?: string | null } | null>(null);
  const setMode = useSetSimpleMode();
  const toggleTask = useToggleTask();
  const { data: rr } = useRunRate();
  const { data: prof } = useMonthProfitability();
  const [expanded, setExpanded] = useState<ExpandKey>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const columnRefs = {
    tasks: useRef<HTMLDivElement>(null),
    collect: useRef<HTMLDivElement>(null),
    quote: useRef<HTMLDivElement>(null),
    services: useRef<HTMLDivElement>(null),
  } as const;

  const toggleExpand = (k: Exclude<ExpandKey, null>) =>
    setExpanded(prev => (prev === k ? null : k));

  const scrollToColumn = (k: ColumnKey) => {
    columnRefs[k].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const detailRef = useRef<HTMLDivElement>(null);
  const handleKpiClick = (k: Exclude<ExpandKey, null>) => {
    const willOpen = expanded !== k;
    toggleExpand(k);
    if (willOpen) {
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  const userName = useMemo(() => {
    const full = profile?.full_name?.trim();
    if (full) return full.split(" ")[0];
    const email = profile?.email ?? "";
    const local = email.split("@")[0];
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
  }, [profile]);

  const totals = data?.totals;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{format(new Date(), "EEEE d 'de' MMMM", { locale: es })}</div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {greeting}{userName ? "," : ""} <span className="text-primary">{userName || "bienvenido"}</span> 👋
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="lg" asChild={WHATSAPP_CHAT_ENABLED}
              disabled={!WHATSAPP_CHAT_ENABLED}
              title={WHATSAPP_CHAT_ENABLED ? undefined : WHATSAPP_DISABLED_REASON}
              onClick={WHATSAPP_CHAT_ENABLED ? undefined : () => blockWhatsappAction()}>
              {WHATSAPP_CHAT_ENABLED
                ? <Link to="/whatsapp"><MessageCircle className="mr-2 h-5 w-5" /> WhatsApp</Link>
                : <><MessageCircle className="mr-2 h-5 w-5" /> WhatsApp</>}
            </Button>
            <Button variant="ghost" size="icon" title="Personalizar mi vista"
              onClick={() => setCustomizeOpen(true)}>
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" title="Volver al modo estándar"
              onClick={async () => { await setMode.mutateAsync(false); window.location.href = "/dashboard"; }}>
              <Settings2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {isLoading && <div className="text-center text-muted-foreground py-12">Cargando tu día…</div>}

        {!isLoading && (
          <LayoutRenderer surface="mi_dia" alwaysVisible={["midia.kpi_row"]}>
            <Widget k="midia.kpi_row">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiChip
                icon={TrendingUp}
                label="Run Rate"
                value={rr ? `${Math.round(rr.runRatePct)}%` : "—"}
                sub={rr ? `Día ${rr.daysElapsed}/${rr.daysTotal}` : undefined}
                tone={rr?.status === "green" ? "success" : rr?.status === "yellow" ? "warning" : rr?.status === "red" ? "danger" : "primary"}
                active={expanded === "runrate"}
                onClick={() => handleKpiClick("runrate")}
              />
              <KpiChip
                icon={PiggyBank}
                label="Rentabilidad"
                value={prof && prof.sales > 0 ? `${prof.pct.toFixed(1)}%` : "—"}
                sub={prof ? `${formatMXN0(prof.profit)}` : undefined}
                tone={prof?.status === "green" ? "success" : prof?.status === "yellow" ? "warning" : prof?.status === "orange" ? "warning" : prof?.status === "red" ? "danger" : "primary"}
                active={expanded === "profit"}
                onClick={() => handleKpiClick("profit")}
              />
              <KpiChip
                icon={Trophy}
                label="Ventas ganadas"
                value={rr ? formatMXN0(rr.sold) : "—"}
                sub={rr && rr.monthGoal > 0 ? `de ${formatMXN0(rr.monthGoal)}` : "Sin meta"}
                tone="success"
                active={expanded === "won"}
                onClick={() => handleKpiClick("won")}
              />
              <SummaryChip icon={ClipboardList} label="Tareas hoy" value={totals?.tasks ?? 0} tone="primary" onClick={() => scrollToColumn("tasks")} />
              <SummaryChip icon={DollarSign} label="Por cobrar" value={totals?.collect ?? 0} sub={totals ? `$${totals.collectAmount.toLocaleString("es-MX")}` : undefined} tone="accent" onClick={() => scrollToColumn("collect")} />
              <SummaryChip icon={FileText} label="Por cotizar" value={totals?.quote ?? 0} tone="warning" onClick={() => scrollToColumn("quote")} />
            </div>
            </Widget>

            <Widget k="midia.detail_expanded">
            <div ref={detailRef} className="scroll-mt-28">
              {expanded === "runrate" && <RunRateCard />}
              {expanded === "profit" && <ProfitabilityCard />}
              {expanded === "won" && rr && <WonDetailCard rr={rr} />}
            </div>
            </Widget>

            <Widget k="midia.collect">
            <div ref={columnRefs.collect} className="scroll-mt-28">
              <JumboColumn
                title="Cobrar hoy"
                description="Deals con pago pendiente que vencen hoy o antes."
                icon={DollarSign}
                items={data?.collect ?? []}
                emptyText="No hay cobros programados."
                onRegisterPayment={(i) => setPayingDeal({ id: i.dealId!, title: i.title, amount: Number(i.amount ?? 0) })}
                onRescheduleCollect={(i) => setReschedDeal({ id: i.dealId!, title: i.title, currentDate: i.dueAt })}
              />
            </div>
            </Widget>
            <Widget k="midia.quote">
            <div ref={columnRefs.quote} className="scroll-mt-28">
              <JumboColumn title="Cotizar" description="Oportunidades esperando tu cotización." icon={FileText} items={data?.quote ?? []} emptyText="No tienes cotizaciones pendientes." />
            </div>
            </Widget>
            <Widget k="midia.services">
            <div ref={columnRefs.services} className="scroll-mt-28 space-y-3">
              <JumboColumn title="Servicios de hoy" description="Mantenimientos e instalaciones agendadas." icon={Wrench} items={data?.services ?? []} emptyText="No hay servicios agendados hoy." />
            </div>
            </Widget>
            <Widget k="midia.followup">
            <JumboColumn title="Seguimiento" description="Clientes en negociación." icon={Sparkles} items={data?.followup ?? []} emptyText="Sin seguimientos activos." />
            </Widget>
            <Widget k="midia.tasks">
            <div ref={columnRefs.tasks} className="scroll-mt-28">
              <JumboColumn
                title="Mis tareas de hoy"
                description="Pendientes tuyos para el día."
                icon={ClipboardList}
                items={data?.tasks ?? []}
                emptyText="¡Estás al día!"
                onToggle={(id) => {
                  const it = (data?.tasks ?? []).find((x) => x.id === id);
                  if (!it) return;
                  if (it.contactId) {
                    setClosingTask({ id: it.id, title: it.title, contactId: it.contactId, taskKind: it.taskKind ?? null, dueAt: it.dueAt ?? null });
                  } else {
                    // Tarea sin contacto asociado: cierre manual directo.
                    toggleTask.mutate({ id, completed: true, via: "manual" }, { onSuccess: () => toast.success("Tarea completada") });
                  }
                }}
              />
            </div>
            </Widget>
          </LayoutRenderer>
        )}
      </main>

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-40">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="lg" className="h-16 rounded-full shadow-2xl px-8 text-lg gap-3">
              <Plus className="h-6 w-6" /> Registrar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuItem onClick={() => setDialogOpen({ kind: "task" })} className="py-3 text-base">
              <ClipboardList className="h-5 w-5 mr-2" /> Tarea rápida
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setExpenseOpen(true)} className="py-3 text-base">
              <Receipt className="h-5 w-5 mr-2" /> Gasto rápido
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <QuickTaskDialog open={!!dialogOpen} onOpenChange={(o) => !o && setDialogOpen(null)} />
      <ExpenseFormDialog open={expenseOpen} onOpenChange={setExpenseOpen} />
      {closingTask && (
        <CloseTaskDialog
          open={!!closingTask}
          onOpenChange={(o) => !o && setClosingTask(null)}
          contactId={closingTask.contactId}
          task={{ id: closingTask.id, title: closingTask.title, taskKind: closingTask.taskKind, dueAt: closingTask.dueAt }}
        />
      )}
      <RegisterPaymentDialog
        open={!!payingDeal}
        onOpenChange={(o) => !o && setPayingDeal(null)}
        deal={payingDeal}
      />
      <RescheduleCollectionDialog
        open={!!reschedDeal}
        onOpenChange={(o) => !o && setReschedDeal(null)}
        deal={reschedDeal}
      />
      <CustomizeSheet open={customizeOpen} onOpenChange={setCustomizeOpen} surface="mi_dia" scope="user" />
    </div>
  );
}

function SummaryChip({ icon: Icon, label, value, sub, tone, onClick }: any) {
  const bg =
    tone === "primary" ? "bg-primary/10 text-primary" :
    tone === "accent"  ? "bg-emerald-500/10 text-emerald-600" :
    tone === "warning" ? "bg-amber-500/10 text-amber-600" :
                         "bg-sky-500/10 text-sky-600";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:shadow-sm active:scale-[0.99] min-w-0"
    >
      <div className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ${bg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">{sub}</div>}
      </div>
    </button>
  );
}

function KpiChip({
  icon: Icon, label, value, sub, tone, active, onClick,
}: {
  icon: any; label: string; value: string; sub?: string;
  tone: "primary" | "success" | "warning" | "danger";
  active: boolean; onClick: () => void;
}) {
  const styles = {
    primary: { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/40" },
    success: { bg: "bg-emerald-500/10", text: "text-emerald-600", ring: "ring-emerald-500/40" },
    warning: { bg: "bg-amber-500/10", text: "text-amber-600", ring: "ring-amber-500/40" },
    danger:  { bg: "bg-red-500/10", text: "text-red-600", ring: "ring-red-500/40" },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 bg-card p-3 text-left transition hover:shadow-sm active:scale-[0.99] min-w-0",
        active ? `ring-2 ${styles.ring} border-transparent` : "border-border hover:border-primary/40",
      )}
    >
      <div className={cn("h-11 w-11 rounded-xl grid place-items-center shrink-0", styles.bg)}>
        <Icon className={cn("h-5 w-5", styles.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("text-lg font-bold leading-tight truncate", styles.text)}>{value}</div>
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">{sub}</div>}
      </div>
      <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", active && "rotate-180")} />
    </button>
  );
}

function WonDetailCard({ rr }: { rr: NonNullable<ReturnType<typeof useRunRate>["data"]> }) {
  const pctOfGoal = rr.monthGoal > 0 ? Math.round((rr.sold / rr.monthGoal) * 100) : 0;
  const rows: Array<{ label: string; value: number }> = [
    { label: "Ventas", value: rr.soldByType.venta },
    { label: "Servicios", value: rr.soldByType.servicio },
    { label: "Refacciones", value: rr.soldByType.refaccion },
  ];
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-2xl">
          <Trophy className="h-7 w-7 text-emerald-600" />
          Ventas ganadas del mes
          <span className="ml-auto text-emerald-600">{formatMXN0(rr.sold)}</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {rr.monthGoal > 0
            ? `${pctOfGoal}% de la meta (${formatMXN0(rr.monthGoal)}) · Proyección ${formatMXN0(rr.projection)}`
            : "Sin meta definida — configúrala para ver avance."}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between rounded-xl border border-border p-3">
            <span className="text-base">{r.label}</span>
            <span className="font-bold">{formatMXN0(r.value)}</span>
          </div>
        ))}
        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <Link to="/pipeline">Ver pipeline</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface JumboColumnProps {
  title: string;
  description: string;
  icon: any;
  items: JumboItem[];
  emptyText: string;
  onToggle?: (id: string) => void;
  onRegisterPayment?: (item: JumboItem) => void;
  onRescheduleCollect?: (item: JumboItem) => void;
}

const PAGE_SIZE = 10;

function JumboColumn({ title, description, icon: Icon, items, emptyText, onToggle, onRegisterPayment, onRescheduleCollect }: JumboColumnProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const visible = items.slice(start, start + PAGE_SIZE);
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
        {visible.map(i => {
          const href =
            i.contactId
              ? (i.kind === "task"
                  ? `/contacts/${i.contactId}?focus=task&taskId=${i.id}`
                  : `/contacts/${i.contactId}`)
              : i.dealId
              ? "/pipeline"
              : null;
          return (
            <div key={`${i.kind}-${i.id}`}
              className={`flex items-center gap-4 rounded-xl border p-4 transition-colors
                ${i.overdue ? "border-destructive/60 bg-destructive/5" : "border-border"}
                ${href ? "hover:bg-muted/60 hover:border-primary/40 cursor-pointer" : "hover:bg-muted/40"}`}>
              {onToggle && i.kind === "task" && (
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0"
                  onClick={(e) => { e.stopPropagation(); onToggle(i.id); }}>
                  <CheckCircle2 className="h-7 w-7" />
                </Button>
              )}
              {href ? (
                <Link to={href} className="flex-1 min-w-0 flex items-center gap-3 group">
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-semibold truncate group-hover:text-primary">{i.title}</div>
                    {i.subtitle && <div className="text-sm text-muted-foreground truncate">{i.subtitle}</div>}
                    {i.dueAt && (
                      <div className={`text-xs mt-1 ${i.overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        {i.overdue && <AlertCircle className="inline h-3 w-3 mr-1" />}
                        {format(new Date(i.dueAt), "PPp", { locale: es })}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ) : (
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
              )}
              {i.amount != null && (
                <div className="text-right shrink-0">
                  <div className="text-xl font-bold">${i.amount.toLocaleString("es-MX")}</div>
                </div>
              )}
              {i.kind === "deal_collect" && onRegisterPayment && (
                <div className="flex flex-col sm:flex-row gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" onClick={() => onRegisterPayment(i)} className="gap-1">
                    <DollarSign className="h-4 w-4" /> Cobrar
                  </Button>
                  {onRescheduleCollect && (
                    <Button size="sm" variant="outline" onClick={() => onRescheduleCollect(i)}>
                      Seguir cobrando
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {items.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
            <span className="text-sm text-muted-foreground">
              {start + 1}–{Math.min(start + PAGE_SIZE, items.length)} de {items.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">{safePage + 1}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}