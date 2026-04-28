import { Lock, Sparkles } from "lucide-react";
import { WBadge } from "@/components/walix/Badge";

interface Props {
  plan: string;
  active: number;
}

function planLimits(plan: string) {
  const p = plan.toLowerCase();
  if (p === "starter") return { max: 0, label: "Starter" };
  if (p === "pyme" || p === "pro") return { max: 3, label: plan };
  return { max: Infinity, label: plan };
}

export function usePlanLimits(plan: string, active: number) {
  const { max, label } = planLimits(plan);
  const remaining = max === Infinity ? Infinity : Math.max(0, max - active);
  return { max, label, remaining, atLimit: active >= max, locked: max === 0 };
}

export function PlanLimitBanner({ plan, active }: Props) {
  const { max, label, locked } = usePlanLimits(plan, active);
  if (locked) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 text-warning border border-warning/20 text-xs font-medium">
        <Lock className="h-3.5 w-3.5" />
        Plan {label}: las automatizaciones se desbloquean en plan PyME
      </div>
    );
  }
  if (max === Infinity) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium">
        <Sparkles className="h-3.5 w-3.5" />
        Plan {label}: automatizaciones ilimitadas
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium">
      <span className="text-foreground">{active} de {max} usadas</span>
      <span className="text-muted-foreground">· Plan {label}</span>
      {active >= max && <WBadge variant="warning">Límite alcanzado</WBadge>}
    </div>
  );
}