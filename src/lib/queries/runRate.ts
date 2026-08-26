import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export interface RunRateData {
  /** "amount" = meta en dinero, "count" = meta en cantidad de ventas. */
  metric: "amount" | "count";
  monthGoal: number;
  goalByType: Record<string, number>;
  sold: number;
  soldByType: Record<string, number>;
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
  /** Desglose por categoría/producto cuando las metas están definidas por categoría. */
  byCategory: { id: string; name: string; goal: number; sold: number; pct: number }[];
  /** true si el Run Rate solo considera las categorías con meta. */
  scopedToCategories: boolean;
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
        .select("count_business_days")
        .eq("id", tenantId!)
        .maybeSingle();

      // Fuente única de metas: monthly_goals (dimensión global / por tipo, métrica monto).
      const { data: goals } = await supabase
        .from("monthly_goals")
        .select("amount, metric, dimension, dimension_value_text, dimension_value_uuid, is_draft")
        .eq("tenant_id", tenantId!)
        .eq("period_year", now.getFullYear())
        .eq("period_month", now.getMonth() + 1);

      const liveGoals = (goals ?? []).filter((g: any) => !g.is_draft);
      // Métrica: si no hay ninguna meta de monto pero sí de cantidad, el Run Rate se mide en unidades.
      const hasAmountGoal = liveGoals.some((g: any) => (g.metric ?? "amount") === "amount");
      const metric: "amount" | "count" = hasAmountGoal ? "amount" : (liveGoals.length > 0 ? "count" : "amount");
      const amountGoals = liveGoals.filter(
        (g: any) => (g.metric ?? "amount") === metric,
      );
      const globalGoal = amountGoals.find((g: any) => g.dimension === "global");

      // Tipos de deal configurados por el tenant (dinámico).
      const { data: dealTypes } = await supabase
        .from("deal_types")
        .select("key")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("position", { ascending: true });
      const typeKeys = (dealTypes ?? []).map((d: any) => d.key).filter(Boolean);
      if (typeKeys.length === 0) typeKeys.push("venta");
      const goalByType: Record<string, number> = {};
      const soldByType: Record<string, number> = {};
      typeKeys.forEach((k) => { goalByType[k] = 0; soldByType[k] = 0; });

      amountGoals
        .filter((g: any) => g.dimension === "deal_type")
        .forEach((g: any) => {
          const t = g.dimension_value_text ?? "";
          if (typeKeys.includes(t)) goalByType[t] += Number(g.amount ?? 0);
        });

      const monthGoal = globalGoal
        ? Number(globalGoal.amount ?? 0)
        : amountGoals
            .filter((g: any) => g.dimension !== "global")
            .reduce((s: number, g: any) => s + Number(g.amount ?? 0), 0);


      // Metas por categoría/producto: el Run Rate se limita a esas categorías.
      const categoryGoals = amountGoals.filter(
        (g: any) => g.dimension === "product_category" && g.dimension_value_uuid,
      );
      const goalByCategory = new Map<string, number>();
      categoryGoals.forEach((g: any) => {
        goalByCategory.set(
          g.dimension_value_uuid,
          (goalByCategory.get(g.dimension_value_uuid) ?? 0) + Number(g.amount ?? 0),
        );
      });
      const scopedToCategories = !globalGoal && goalByCategory.size > 0 && goalByCategory.size === amountGoals.length;

      const countBusinessDays = (tenant as any)?.count_business_days ?? true;

      const daysTotal = countBusinessDays
        ? countBizDays(monthStart, monthEnd)
        : monthEnd.getDate();
      const daysElapsed = countBusinessDays
        ? countBizDays(monthStart, now)
        : now.getDate();

      const { data: wonDeals } = await supabase
        .from("deals")
        .select("amount, deal_type, won_at, product_category_id")
        .eq("is_won", true)
        .gte("won_at", monthStart.toISOString())
        .lte("won_at", new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate(), 23, 59, 59).toISOString());

      const soldByCategory = new Map<string, number>();
      let sold = 0;
      (wonDeals ?? []).forEach((d: any) => {
        // En metas por cantidad cada oportunidad ganada suma 1.
        const amt = metric === "count" ? 1 : Number(d.amount ?? 0);
        const catId = d.product_category_id ?? null;
        if (catId && goalByCategory.has(catId)) {
          soldByCategory.set(catId, (soldByCategory.get(catId) ?? 0) + amt);
        }
        if (scopedToCategories && !(catId && goalByCategory.has(catId))) return;
        sold += amt;
        const t = d.deal_type ?? "venta";
        if (typeKeys.includes(t)) soldByType[t] += amt;
      });


      let categoryNames: Record<string, string> = {};
      if (goalByCategory.size > 0) {
        const { data: cats } = await supabase
          .from("product_categories")
          .select("id, name")
          .in("id", Array.from(goalByCategory.keys()));
        (cats ?? []).forEach((c: any) => { categoryNames[c.id] = c.name; });
      }
      const byCategory = Array.from(goalByCategory.entries()).map(([id, goal]) => {
        const s = soldByCategory.get(id) ?? 0;
        return { id, name: categoryNames[id] ?? "Categoría", goal, sold: s, pct: goal > 0 ? (s / goal) * 100 : 0 };
      });

      const { data: openDeals } = await supabase
        .from("deals")
        .select("amount, stage_name, product_category_id")
        .eq("is_won", false)
        .eq("is_lost", false);

      let openQuotesAmount = 0, openQuotesCount = 0;
      let negotiationAmount = 0, negotiationCount = 0;
      (openDeals ?? []).forEach((d: any) => {
        if (scopedToCategories && !(d.product_category_id && goalByCategory.has(d.product_category_id))) return;
        const amt = metric === "count" ? 1 : Number(d.amount ?? 0);
        const sn = (d.stage_name ?? "").toLowerCase();
        if (/cotiz/.test(sn)) { openQuotesAmount += amt; openQuotesCount++; }
        if (/negoc|propuesta/.test(sn)) { negotiationAmount += amt; negotiationCount++; }
      });

      const expectedToday = daysTotal > 0 ? monthGoal * (daysElapsed / daysTotal) : 0;
      const runRatePct = expectedToday > 0 ? (sold / expectedToday) * 100 : (sold > 0 ? 100 : 0);
      const projection = daysElapsed > 0 ? (sold / daysElapsed) * daysTotal : 0;
      const gap = Math.max(0, monthGoal - sold);

      const fmt = (n: number) =>
        metric === "count"
          ? `${Math.round(n).toLocaleString("es-MX")} ventas`
          : `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

      const recs: string[] = [];
      if (monthGoal <= 0) {
        recs.push("Define una meta mensual en Configuración → Metas para ver el Run Rate.");
      } else if (runRatePct >= 100) {
        recs.push(`Vas por delante de la meta. Proyección: ${fmt(projection)}.`);
        if (openQuotesCount > 0) recs.push(`Aprovecha las ${openQuotesCount} cotizaciones abiertas (${fmt(openQuotesAmount)}) para superar la meta.`);
      } else {
        if (gap > 0 && openQuotesAmount + negotiationAmount >= gap) {
          recs.push(`Te faltan ${fmt(gap)} para llegar a la meta. Puedes cubrirlos cerrando las ${openQuotesCount} cotizaciones (${fmt(openQuotesAmount)}) y/o las ${negotiationCount} en negociación (${fmt(negotiationAmount)}).`);
        } else if (gap > 0) {
          recs.push(`Te faltan ${fmt(gap)} para la meta. Tu pipeline abierto (${fmt(openQuotesAmount + negotiationAmount)}) no alcanza; prospecta más.`);
        }
        if (openQuotesCount > 0) recs.push(`Cierra las ${openQuotesCount} cotizaciones pendientes lo antes posible.`);
        if (negotiationCount > 0) recs.push(`Da seguimiento a los ${negotiationCount} deals en negociación.`);
      }

      return {
        metric,
        monthGoal, goalByType, sold, soldByType,
        expectedToday, runRatePct, projection,
        daysElapsed, daysTotal, countBusinessDays,
        gap, recommendations: recs.slice(0, 3),
        status: statusFor(runRatePct),
        openQuotesAmount, openQuotesCount, negotiationAmount, negotiationCount,
        byCategory, scopedToCategories,
      };
    },
  });
}

export function formatMXN0(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}