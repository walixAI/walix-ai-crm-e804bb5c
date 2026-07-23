import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export interface RunRateData {
  monthGoal: number;
  goalByType: { venta: number; servicio: number; refaccion: number };
  sold: number;
  soldByType: { venta: number; servicio: number; refaccion: number };
  expectedToday: number;
  runRatePct: number;
  projection: number;
  daysElapsed: number;
  daysTotal: number;
  countBusinessDays: boolean;
  gap: number;
  recommendations: string[];
  status: "green" | "yellow" | "red";
  openQuotesAmount: number;
  openQuotesCount: number;
  negotiationAmount: number;
  negotiationCount: number;
}

function countBizDays(from: Date, to: Date) {
  let n = 0;
  const d = new Date(from);
  while (d <= to) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

function statusFor(pct: number): "green" | "yellow" | "red" {
  if (pct >= 100) return "green";
  if (pct >= 70) return "yellow";
  return "red";
}

export function useRunRate() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["run-rate", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async (): Promise<RunRateData> => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { data: tenant } = await supabase
        .from("tenants")
        .select("monthly_goal_total, monthly_goal_by_type, count_business_days")
        .eq("id", tenantId!)
        .maybeSingle();

      // Meta vigente del mes en curso: última versión guardada en tenant_monthly_goals;
      // si no hay, cae a los defaults legacy en tenants.
      const { data: monthlyGoal } = await supabase
        .from("tenant_monthly_goals" as any)
        .select("monthly_goal_total, monthly_goal_by_type, count_business_days")
        .eq("tenant_id", tenantId!)
        .eq("period_year", now.getFullYear())
        .eq("period_month", now.getMonth() + 1)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const src: any = monthlyGoal ?? tenant ?? {};
      const monthGoal = Number(src.monthly_goal_total ?? 0);
      const goalByTypeRaw = (src.monthly_goal_by_type ?? {}) as any;
      const goalByType = {
        venta: Number(goalByTypeRaw.venta ?? 0),
        servicio: Number(goalByTypeRaw.servicio ?? 0),
        refaccion: Number(goalByTypeRaw.refaccion ?? 0),
      };
      const countBusinessDays = src.count_business_days ?? true;

      const daysTotal = countBusinessDays
        ? countBizDays(monthStart, monthEnd)
        : monthEnd.getDate();
      const daysElapsed = countBusinessDays
        ? countBizDays(monthStart, now)
        : now.getDate();

      const { data: wonDeals } = await supabase
        .from("deals")
        .select("amount, deal_type, updated_at")
        .eq("is_won", true)
        .gte("updated_at", monthStart.toISOString())
        .lte("updated_at", new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate(), 23, 59, 59).toISOString());

      const soldByType = { venta: 0, servicio: 0, refaccion: 0 };
      let sold = 0;
      (wonDeals ?? []).forEach((d: any) => {
        const amt = Number(d.amount ?? 0);
        sold += amt;
        const t = (d.deal_type ?? "venta") as "venta" | "servicio" | "refaccion";
        if (t in soldByType) soldByType[t] += amt;
      });

      const { data: openDeals } = await supabase
        .from("deals")
        .select("amount, stage_name")
        .eq("is_won", false)
        .eq("is_lost", false);

      let openQuotesAmount = 0, openQuotesCount = 0;
      let negotiationAmount = 0, negotiationCount = 0;
      (openDeals ?? []).forEach((d: any) => {
        const amt = Number(d.amount ?? 0);
        const sn = (d.stage_name ?? "").toLowerCase();
        if (/cotiz/.test(sn)) { openQuotesAmount += amt; openQuotesCount++; }
        if (/negoc|propuesta/.test(sn)) { negotiationAmount += amt; negotiationCount++; }
      });

      const expectedToday = daysTotal > 0 ? monthGoal * (daysElapsed / daysTotal) : 0;
      const runRatePct = expectedToday > 0 ? (sold / expectedToday) * 100 : (sold > 0 ? 100 : 0);
      const projection = daysElapsed > 0 ? (sold / daysElapsed) * daysTotal : 0;
      const gap = Math.max(0, monthGoal - sold);

      const recs: string[] = [];
      if (monthGoal <= 0) {
        recs.push("Define una meta mensual en Configuración → Metas para ver el Run Rate.");
      } else if (runRatePct >= 100) {
        recs.push(`Vas por delante de la meta. Proyección: $${projection.toLocaleString("es-MX", { maximumFractionDigits: 0 })}.`);
        if (openQuotesCount > 0) recs.push(`Aprovecha las ${openQuotesCount} cotizaciones abiertas ($${openQuotesAmount.toLocaleString("es-MX")}) para superar la meta.`);
      } else {
        if (gap > 0 && openQuotesAmount + negotiationAmount >= gap) {
          recs.push(`Te faltan $${gap.toLocaleString("es-MX")} para llegar a la meta. Puedes cubrirlos cerrando las ${openQuotesCount} cotizaciones ($${openQuotesAmount.toLocaleString("es-MX")}) y/o las ${negotiationCount} en negociación ($${negotiationAmount.toLocaleString("es-MX")}).`);
        } else if (gap > 0) {
          recs.push(`Te faltan $${gap.toLocaleString("es-MX")} para la meta. Tu pipeline abierto ($${(openQuotesAmount + negotiationAmount).toLocaleString("es-MX")}) no alcanza; prospecta más.`);
        }
        if (openQuotesCount > 0) recs.push(`Cierra las ${openQuotesCount} cotizaciones pendientes lo antes posible.`);
        if (negotiationCount > 0) recs.push(`Da seguimiento a los ${negotiationCount} deals en negociación.`);
      }

      return {
        monthGoal, goalByType, sold, soldByType,
        expectedToday, runRatePct, projection,
        daysElapsed, daysTotal, countBusinessDays,
        gap, recommendations: recs.slice(0, 3),
        status: statusFor(runRatePct),
        openQuotesAmount, openQuotesCount, negotiationAmount, negotiationCount,
      };
    },
  });
}

export function formatMXN0(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}