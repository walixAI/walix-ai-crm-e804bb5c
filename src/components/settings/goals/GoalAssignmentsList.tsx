import { useGoalAssignments } from "@/lib/queries/monthlyGoals";
import { useMembers } from "@/lib/queries/team";
import { useTenantId } from "@/lib/queries/tenant";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

export function GoalAssignmentsList({ goalId, amount }: { goalId: string; amount: number }) {
  const { data: assignments = [] } = useGoalAssignments(goalId);
  const { data: tenantId } = useTenantId();
  const { data: members = [] } = useMembers(tenantId);

  if (assignments.length === 0) {
    return (
      <div className="px-3 py-2 pl-6 text-xs text-muted-foreground italic border-t border-dashed">
        Sin agentes asignados. Edita la meta para repartirla.
      </div>
    );
  }

  return (
    <div className="px-3 pb-2 pl-6 pt-1 border-t border-dashed space-y-1">
      {assignments.map((a) => {
        const m: any = members.find((x: any) => x.id === a.user_id);
        const label = m?.full_name ?? m?.email ?? "Usuario";
        const userAmt = Math.round(amount * Number(a.share_percent)) / 100;
        return (
          <div key={a.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-5 w-5">
                {m?.avatar_url && <AvatarImage src={m.avatar_url} />}
                <AvatarFallback className="text-[10px]">{label.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="truncate">{label}</span>
            </div>
            <div className="tabular-nums text-muted-foreground">
              {Number(a.share_percent).toFixed(2)}% · <span className="text-foreground font-medium">{formatMXN(userAmt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}