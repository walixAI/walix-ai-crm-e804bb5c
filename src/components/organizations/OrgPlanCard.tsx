import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Crown } from "lucide-react";
import type { OrgPlanLimit } from "@/lib/queries/organizations";
import { orgPlanLabel } from "@/lib/plans";

interface Props {
  plan: string;
  tenantCount: number;
  limit?: OrgPlanLimit;
}

export function OrgPlanCard({ plan, tenantCount, limit }: Props) {
  const max = limit?.max_tenants ?? 1;
  const pct = Math.min(100, (tenantCount / max) * 100);
  const reached = tenantCount >= max;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Plan de organización</p>
            <p className="text-lg font-bold">{orgPlanLabel(plan)}</p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          Mejorar plan
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Empresas activas</span>
          <span className="font-medium">
            {tenantCount} / {max === 999 ? "∞" : max}
          </span>
        </div>
        <Progress value={pct} className="h-2" />
        {reached && max < 999 && (
          <p className="text-xs text-amber-600">
            Has alcanzado el límite de tu plan. Mejóralo para crear más empresas.
          </p>
        )}
      </div>
    </Card>
  );
}
