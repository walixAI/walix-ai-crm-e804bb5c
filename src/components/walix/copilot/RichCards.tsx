import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TrendingUp, Target, Wallet, CircleDollarSign } from "lucide-react";

const STAGE_DOTS = [
  "bg-success",
  "bg-info",
  "bg-warning",
  "bg-primary",
  "bg-accent",
];

export function dotForIndex(i: number) {
  return STAGE_DOTS[i % STAGE_DOTS.length];
}

export function money(n: unknown, currency = "MXN") {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

/** Tarjeta base con el look de la landing (superficie elevada + borde suave). */
export function CopilotCard({
  title,
  icon,
  children,
  className,
}: {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden",
        className,
      )}
    >
      {title && (
        <div className="flex items-center gap-1.5 px-3.5 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {icon}
          {title}
        </div>
      )}
      <div className={cn(title ? "px-3.5 pb-3" : "p-3.5")}>{children}</div>
    </div>
  );
}

export type ListRow = {
  id?: string;
  title: string;
  subtitle?: string;
  value?: string;
  to?: string;
};

/** Lista tipo "Pipeline · hoy" de la landing. */
export function CopilotListCard({
  title,
  icon,
  rows,
  emptyLabel = "Sin resultados",
}: {
  title: string;
  icon?: ReactNode;
  rows: ListRow[];
  emptyLabel?: string;
}) {
  const navigate = useNavigate();
  return (
    <CopilotCard title={title} icon={icon}>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-1">{emptyLabel}</div>
      ) : (
        <div className="divide-y divide-border/60">
          {rows.map((r, i) => (
            <button
              key={r.id ?? `${r.title}-${i}`}
              type="button"
              disabled={!r.to}
              onClick={() => r.to && navigate(r.to)}
              className={cn(
                "w-full flex items-center gap-2.5 py-2 text-left first:pt-0 last:pb-0",
                r.to && "hover:opacity-80 transition-opacity",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full shrink-0", dotForIndex(i))} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-foreground truncate">
                  {r.title}
                </span>
                {r.subtitle && (
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {r.subtitle}
                  </span>
                )}
              </span>
              {r.value && (
                <span className="text-[13px] font-bold text-foreground shrink-0 tabular-nums">
                  {r.value}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </CopilotCard>
  );
}

const KPI_TONES = {
  success: "bg-success/10 text-success",
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
} as const;

export type KpiItem = {
  label: string;
  value: string;
  tone?: keyof typeof KPI_TONES;
  icon?: "trend" | "target" | "wallet" | "money";
  emphasis?: boolean;
};

const KPI_ICONS = {
  trend: TrendingUp,
  target: Target,
  wallet: Wallet,
  money: CircleDollarSign,
};

/** Píldoras de KPI ("Cierres hoy +47%") como en la landing. */
export function CopilotKpiRow({ items }: { items: KpiItem[] }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((k, i) => {
        const tone = k.tone ?? "primary";
        const Icon = KPI_ICONS[k.icon ?? "trend"];
        return (
          <div
            key={`${k.label}-${i}`}
            className="rounded-2xl border border-border/70 bg-card/80 px-3 py-2.5 shadow-sm"
          >
            <div className={cn("h-7 w-7 grid place-items-center rounded-lg mb-1.5", KPI_TONES[tone])}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground truncate">
              {k.label}
            </div>
            <div
              className={cn(
                "text-lg font-bold leading-tight tabular-nums",
                k.emphasis ? "text-success" : "text-foreground",
              )}
            >
              {k.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
