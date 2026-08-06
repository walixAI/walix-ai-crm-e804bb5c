import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Search, Brain, BarChart3, UserPlus, Briefcase, MoveRight, StickyNote,
  CheckCircle2, MessageCircle, Wrench, Check, AlertCircle, Users, Wallet,
  Target, Lightbulb, BookOpen, ListChecks,
} from "lucide-react";
import type { CopilotToolUse } from "@/services/ai";
import { CopilotCard, CopilotListCard, CopilotKpiRow, money, type ListRow, type KpiItem } from "./RichCards";

const TOOL_META: Record<string, { icon: any; label: string }> = {
  search_contacts: { icon: Search, label: "Contactos" },
  get_contact_context: { icon: Brain, label: "Contexto" },
  get_pipeline_status: { icon: BarChart3, label: "Pipeline · hoy" },
  create_contact: { icon: UserPlus, label: "Contacto creado" },
  create_deal: { icon: Briefcase, label: "Oportunidad creada" },
  move_deal_stage: { icon: MoveRight, label: "Etapa actualizada" },
  add_note: { icon: StickyNote, label: "Nota agregada" },
  create_task: { icon: CheckCircle2, label: "Tarea creada" },
  prepare_whatsapp_message: { icon: MessageCircle, label: "Mensaje preparado" },
  get_my_tasks: { icon: ListChecks, label: "Mis pendientes" },
  get_my_deals: { icon: Briefcase, label: "Oportunidades" },
  get_my_suggestions: { icon: Lightbulb, label: "Sugerencias" },
  get_run_rate: { icon: Target, label: "Run rate del mes" },
  get_profitability: { icon: Wallet, label: "Rentabilidad" },
  get_expenses_summary: { icon: Wallet, label: "Gastos del mes" },
  get_monthly_goal: { icon: Target, label: "Meta del mes" },
  get_team_performance: { icon: Users, label: "Equipo" },
  get_help_topic: { icon: BookOpen, label: "Guía Walix" },
};

function fmtDate(d?: string | null) {
  if (!d) return undefined;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

/** Tarjeta compacta de "acción realizada" con CTA opcional. */
function ActionCard({
  icon: Icon, label, summary, cta, isError,
}: {
  icon: any; label: string; summary: string;
  cta?: { label: string; to: string } | null; isError?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-xs shadow-sm",
        isError
          ? "bg-destructive/5 border-destructive/30"
          : "bg-card/80 border-border/70",
      )}
    >
      <div
        className={cn(
          "h-7 w-7 grid place-items-center rounded-lg shrink-0",
          isError ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
        )}
      >
        {isError ? <AlertCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="font-semibold text-foreground">{label}</span>
        </div>
        <div className="text-muted-foreground mt-0.5 break-words line-clamp-2">{summary}</div>
      </div>
      {cta && (
        <button
          type="button"
          onClick={() => navigate(cta.to)}
          className="text-primary hover:underline font-medium shrink-0 self-center whitespace-nowrap"
        >
          {cta.label} →
        </button>
      )}
    </div>
  );
}

export function ToolResult({ tool }: { tool: CopilotToolUse }) {
  const meta = TOOL_META[tool.name] ?? { icon: Wrench, label: tool.name };
  const Icon = meta.icon;
  const r = tool.result as any;
  const isError = !!r && typeof r === "object" && ("error" in r || r.ok === false);

  if (isError) {
    return (
      <ActionCard
        icon={Icon}
        label={meta.label}
        summary={String(r?.error ?? "No se pudo completar")}
        isError
      />
    );
  }

  switch (tool.name) {
    case "get_pipeline_status": {
      const kpis: KpiItem[] = [
        { label: "En curso", value: String(r?.open ?? 0), icon: "trend", tone: "primary" },
        { label: "Monto abierto", value: money(r?.open_amount), icon: "money", tone: "success", emphasis: true },
        { label: "Ganadas", value: String(r?.won ?? 0), icon: "target", tone: "success" },
        { label: "Perdidas", value: String(r?.lost ?? 0), icon: "wallet", tone: "warning" },
      ];
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3" /> {r?.pipeline_name ?? "Pipeline"}
          </div>
          <CopilotKpiRow items={kpis} />
        </div>
      );
    }

    case "get_my_deals": {
      const deals: any[] = Array.isArray(r?.deals) ? r.deals : [];
      const rows: ListRow[] = deals.slice(0, 6).map((d) => ({
        id: d.id,
        title: d.name ?? "Oportunidad",
        subtitle: [d.stage_name, d.owner_name, fmtDate(d.expected_close_date)].filter(Boolean).join(" · "),
        value: money(d.amount),
        to: `/pipeline?dealId=${d.id}`,
      }));
      return (
        <div className="space-y-2">
          <CopilotListCard
            title={`Oportunidades · ${r?.count ?? rows.length}`}
            icon={<Briefcase className="h-3 w-3" />}
            rows={rows}
            emptyLabel="Sin oportunidades abiertas"
          />
          {Number(r?.total_amount) > 0 && (
            <CopilotKpiRow items={[{ label: "Total en curso", value: money(r.total_amount), icon: "money", tone: "success", emphasis: true }]} />
          )}
        </div>
      );
    }

    case "get_my_tasks": {
      const tasks: any[] = Array.isArray(r?.tasks) ? r.tasks : [];
      const rows: ListRow[] = tasks.slice(0, 8).map((t) => ({
        id: t.id,
        title: t.title ?? "Tarea",
        subtitle: [t.contact_name ?? t.deal_name, t.is_overdue ? "Vencida" : fmtDate(t.due_at)]
          .filter(Boolean).join(" · "),
        to: "/tasks",
      }));
      return (
        <CopilotListCard
          title={`Pendientes · ${r?.count ?? rows.length}`}
          icon={<ListChecks className="h-3 w-3" />}
          rows={rows}
          emptyLabel="Sin pendientes 🎉"
        />
      );
    }

    case "search_contacts": {
      const items: any[] = Array.isArray(r?.contacts) ? r.contacts : [];
      const rows: ListRow[] = items.slice(0, 6).map((c) => ({
        id: c.id,
        title: [c.name, c.last_name].filter(Boolean).join(" "),
        subtitle: [c.status, c.phone].filter(Boolean).join(" · "),
        to: `/contacts/${c.id}`,
      }));
      return (
        <CopilotListCard
          title={`Contactos · ${rows.length}`}
          icon={<Search className="h-3 w-3" />}
          rows={rows}
          emptyLabel="Sin resultados"
        />
      );
    }

    case "get_team_performance": {
      const rows: ListRow[] = (Array.isArray(r?.team) ? r.team : []).slice(0, 6).map((t: any) => ({
        id: t.owner_id,
        title: t.owner_name ?? "Sin asignar",
        subtitle: `${t.count} cierres`,
        value: money(t.amount),
      }));
      return (
        <CopilotListCard title="Equipo · cierres del mes" icon={<Users className="h-3 w-3" />} rows={rows} />
      );
    }

    case "get_run_rate":
      return (
        <CopilotKpiRow
          items={[
            { label: "Run rate", value: `${r?.percent_vs_goal ?? 0}%`, icon: "target", tone: "primary", emphasis: Number(r?.percent_vs_goal) >= 100 },
            { label: "Proyección", value: money(r?.projected_month_end), icon: "trend", tone: "info" },
            { label: "Vendido MTD", value: money(r?.revenue_mtd), icon: "money", tone: "success" },
            { label: "Meta", value: money(r?.goal_total), icon: "wallet", tone: "warning" },
          ]}
        />
      );

    case "get_profitability":
      return (
        <CopilotKpiRow
          items={[
            { label: "Margen", value: `${r?.margin_percent ?? 0}%`, icon: "target", tone: "success", emphasis: Number(r?.margin_percent) >= 25 },
            { label: "Utilidad", value: money(r?.profit), icon: "money", tone: "primary" },
            { label: "Ingresos", value: money(r?.revenue), icon: "trend", tone: "info" },
            { label: "Gastos", value: money(r?.expenses_total), icon: "wallet", tone: "warning" },
          ]}
        />
      );

    case "get_expenses_summary": {
      const rows: ListRow[] = (Array.isArray(r?.by_category) ? r.by_category : []).slice(0, 6).map((c: any) => ({
        title: c.category,
        value: money(c.amount),
      }));
      return (
        <div className="space-y-2">
          <CopilotKpiRow
            items={[
              { label: "Total", value: money(r?.total), icon: "wallet", tone: "warning" },
              { label: "Fijos", value: money(r?.fijo), icon: "money", tone: "info" },
            ]}
          />
          {rows.length > 0 && (
            <CopilotListCard title="Por categoría" icon={<Wallet className="h-3 w-3" />} rows={rows} />
          )}
        </div>
      );
    }

    case "get_monthly_goal":
      return (
        <CopilotKpiRow
          items={[{ label: "Meta del mes", value: money(r?.monthly_goal_total), icon: "target", tone: "primary" }]}
        />
      );

    case "get_my_suggestions": {
      const rows: ListRow[] = (Array.isArray(r?.suggestions) ? r.suggestions : []).slice(0, 5).map((s: any) => ({
        id: s.id,
        title: s.suggestion_text,
        subtitle: `Prioridad ${s.priority}`,
      }));
      return (
        <CopilotListCard title="Sugerencias" icon={<Lightbulb className="h-3 w-3" />} rows={rows} emptyLabel="Nada pendiente por ahora" />
      );
    }

    case "get_help_topic":
      return (
        <CopilotCard title="Guía Walix" icon={<BookOpen className="h-3 w-3" />}>
          <div className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words line-clamp-6">
            {typeof r?.content === "string" ? r.content : r?.summary ?? "Tema cargado"}
          </div>
        </CopilotCard>
      );

    case "create_contact":
      return (
        <ActionCard icon={Icon} label={meta.label} summary={r?.contact?.name ?? "Contacto creado"}
          cta={r?.contact?.id ? { label: "Ver", to: `/contacts/${r.contact.id}` } : null} />
      );
    case "create_deal":
      return (
        <ActionCard icon={Icon} label={meta.label} summary={r?.deal?.name ?? "Oportunidad creada"}
          cta={{ label: "Ver pipeline", to: "/pipeline" }} />
      );
    case "move_deal_stage":
      return (
        <ActionCard icon={Icon} label={meta.label}
          summary={r?.deal?.stage_name ? `Movida a ${r.deal.stage_name}` : "Etapa actualizada"}
          cta={r?.deal?.id ? { label: "Ver deal", to: `/pipeline?dealId=${r.deal.id}` } : null} />
      );
    case "create_task":
      return (
        <ActionCard icon={Icon} label={meta.label} summary={r?.task?.title ?? "Tarea creada"}
          cta={{ label: "Ver tareas", to: "/tasks" }} />
      );
    case "add_note":
      return <ActionCard icon={Icon} label={meta.label} summary="Nota guardada en el contacto" />;
    case "get_contact_context":
      return (
        <CopilotCard title="Contexto del contacto" icon={<Brain className="h-3 w-3" />}>
          <div className="text-[13px] leading-relaxed text-muted-foreground line-clamp-4">
            {r?.summary ?? r?.context_summary ?? "Contexto cargado"}
          </div>
        </CopilotCard>
      );
    case "prepare_whatsapp_message":
      return null; // se muestra en la tarjeta de sugerencia de WhatsApp
    default:
      return <ActionCard icon={Icon} label={meta.label} summary="Listo" />;
  }
}
