import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantId } from "@/lib/queries/tenant";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenantUsers } from "@/lib/queries/tenantUsers";
import { logAudit, fetchAuditLog, type AuditEntry } from "@/services/audit";

const EXPENSE_TRACKED_FIELDS = ["amount", "category_id", "incurred_at", "description", "status", "kind"] as const;

/** Deja solo los campos relevantes de un gasto para el historial. */
function pickExpenseFields(row: any): Record<string, unknown> {
  if (!row) return {};
  const out: Record<string, unknown> = {};
  for (const f of EXPENSE_TRACKED_FIELDS) if (f in row) out[f] = row[f];
  return out;
}

/** Compara valores previos contra el parche y devuelve solo lo que cambió. */
function diffFields(before: Record<string, unknown>, patch: Record<string, unknown>) {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const [k, v] of Object.entries(patch)) {
    const prev = before[k];
    const same = Number.isFinite(Number(prev)) && Number.isFinite(Number(v))
      ? Number(prev) === Number(v)
      : (prev ?? null) === (v ?? null);
    if (!same) changes[k] = { before: prev ?? null, after: v ?? null };
  }
  return changes;
}

export interface ExpenseCategory {
  id: string;
  tenant_id: string;
  name: string;
  kind: "fijo" | "variable";
  icon: string | null;
  is_active: boolean;
}

export interface Expense {
  id: string;
  tenant_id: string;
  owner_id: string | null;
  kind: "fijo" | "variable";
  category_id: string | null;
  amount: number;
  currency: string;
  incurred_at: string;
  deal_id: string | null;
  description: string | null;
  receipt_url: string | null;
  created_at: string;
  status?: "draft" | "confirmed";
  source?: "manual" | "recurring" | "rule" | "whatsapp";
  rule_id?: string | null;
  recurring_id?: string | null;
}

export interface RecurringExpense {
  id: string;
  tenant_id: string;
  category_id: string | null;
  amount: number;
  day_of_month: number;
  description: string | null;
  is_active: boolean;
}

export type RuleType = "percent_of_deal" | "fixed_per_deal" | "percent_of_cost";

export interface ExpenseRule {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  rule_type: RuleType;
  value: number;
  deal_type_filter: "venta" | "servicio" | null;
  auto_confirm: boolean;
  is_active: boolean;
}

export function useExpenseCategories() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["expense-categories", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories" as any)
        .select("*")
        .eq("is_active", true)
        .order("kind", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ExpenseCategory[];
    },
  });
}

export function useAllExpenseCategories() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["expense-categories-all", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories" as any)
        .select("*")
        .order("kind", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ExpenseCategory[];
    },
  });
}

export interface ExpenseFilters {
  month?: Date; // any date in the month
  kind?: "fijo" | "variable" | "all";
  categoryId?: string | null;
  status?: "draft" | "confirmed" | "all";
}

/**
 * Alcance de gastos: administradores/gerentes ven todo el tenant,
 * un vendedor solo ve (y edita) los gastos variables que le corresponden.
 */
export function useExpenseScope() {
  const { user } = useAuth();
  const { isTenantAdmin, isManager, isPlatform } = usePermissions();
  const canSeeAll = isTenantAdmin || isManager || isPlatform;
  return {
    canSeeAll,
    canManageFixed: canSeeAll,
    userId: user?.id ?? null,
    canEdit: (e: Pick<Expense, "owner_id" | "kind">) =>
      canSeeAll || (e.kind !== "fijo" && e.owner_id === user?.id),
  };
}

export function useExpenses(filters: ExpenseFilters = {}) {
  const { data: tenantId } = useTenantId();
  const { canSeeAll, userId } = useExpenseScope();
  return useQuery({
    queryKey: ["expenses", tenantId, filters.month?.toISOString().slice(0, 7), filters.kind, filters.categoryId, canSeeAll, userId],
    enabled: !!tenantId && !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const month = filters.month ?? new Date();
      const from = new Date(month.getFullYear(), month.getMonth(), 1);
      const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      let q = supabase
        .from("expenses" as any)
        .select("*")
        .gte("incurred_at", from.toISOString().slice(0, 10))
        .lte("incurred_at", to.toISOString().slice(0, 10))
        .order("incurred_at", { ascending: false });
      if (filters.kind && filters.kind !== "all") q = q.eq("kind", filters.kind);
      if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
      if (!canSeeAll) {
        // El vendedor solo ve sus gastos variables (los fijos son del negocio).
        q = q.eq("owner_id", userId!).eq("kind", "variable");
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Expense[];
    },
  });
}

export function useDraftExpenses() {
  const { data: tenantId } = useTenantId();
  const { canSeeAll, userId } = useExpenseScope();
  return useQuery({
    queryKey: ["expenses-drafts", tenantId, canSeeAll, userId],
    enabled: !!tenantId && !!userId,
    staleTime: 15_000,
    queryFn: async () => {
      let q = supabase
        .from("expenses" as any)
        .select("*")
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      if (!canSeeAll) q = q.eq("owner_id", userId!).eq("kind", "variable");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Expense[];
    },
  });
}

export function useConfirmExpense() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: { id: string; amount?: number }) => {
      const patch: any = { status: "confirmed" };
      if (typeof input.amount === "number") patch.amount = input.amount;
      const { data: before } = await supabase
        .from("expenses" as any).select("*").eq("id", input.id).maybeSingle();
      const { error } = await supabase.from("expenses" as any).update(patch).eq("id", input.id);
      if (error) throw error;
      await logAudit({
        action: "expense.confirmed",
        tenantId: (before as any)?.tenant_id ?? tenantId ?? null,
        targetType: "expense",
        targetId: input.id,
        metadata: { changes: diffFields(pickExpenseFields(before), patch) },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-drafts"] });
      qc.invalidateQueries({ queryKey: ["month-profit"] });
      qc.invalidateQueries({ queryKey: ["expense-history"] });
    },
  });
}

export function useConfirmAllDrafts() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Sin tenant");
      const { error } = await supabase
        .from("expenses" as any)
        .update({ status: "confirmed" } as any)
        .eq("tenant_id", tenantId)
        .eq("status", "draft");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-drafts"] });
      qc.invalidateQueries({ queryKey: ["month-profit"] });
    },
  });
}

export function useMonthProfitability() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["month-profit", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const [wonRes, expRes, tenRes] = await Promise.all([
        supabase.from("deals").select("amount")
          .eq("is_won", true)
          .gte("updated_at", from.toISOString())
          .lte("updated_at", new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59).toISOString()),
        supabase.from("expenses" as any).select("amount")
          .eq("status", "confirmed")
          .gte("incurred_at", from.toISOString().slice(0, 10))
          .lte("incurred_at", to.toISOString().slice(0, 10)),
        supabase.from("tenants").select("profit_thresholds").eq("id", tenantId!).maybeSingle(),
      ]);

      const sales = (wonRes.data ?? []).reduce((s: number, d: any) => s + Number(d.amount ?? 0), 0);
      const expenses = ((expRes.data as any[]) ?? []).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
      const profit = sales - expenses;
      const pct = sales > 0 ? (profit / sales) * 100 : 0;
      const th = ((tenRes.data as any)?.profit_thresholds ?? { green: 20, yellow: 10, orange: 0 });
      let status: "green" | "yellow" | "orange" | "red" = "red";
      if (pct >= th.green) status = "green";
      else if (pct >= th.yellow) status = "yellow";
      else if (pct >= th.orange) status = "orange";

      // count pending drafts for banner
      const { count: pendingDrafts } = await supabase
        .from("expenses" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "draft");
      return { sales, expenses, profit, pct, status, thresholds: th, pendingDrafts: pendingDrafts ?? 0 };
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: {
      kind: "fijo" | "variable";
      category_id: string | null;
      amount: number;
      incurred_at: string;
      deal_id?: string | null;
      description?: string | null;
      receipt_url?: string | null;
    }) => {
      if (!tenantId || !user?.id) throw new Error("Sin sesión");
      const { data, error } = await supabase.from("expenses" as any).insert({
        tenant_id: tenantId,
        owner_id: user.id,
        currency: "MXN",
        ...input,
      } as any).select("id").single();
      if (error) throw error;
      await logAudit({
        action: "expense.created",
        tenantId,
        targetType: "expense",
        targetId: (data as any)?.id ?? null,
        metadata: { after: input },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["month-profit"] });
      qc.invalidateQueries({ queryKey: ["expense-history"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: before } = await supabase
        .from("expenses" as any).select("*").eq("id", id).maybeSingle();
      const { error } = await supabase.from("expenses" as any).delete().eq("id", id);
      if (error) throw error;
      await logAudit({
        action: "expense.deleted",
        tenantId: (before as any)?.tenant_id ?? tenantId ?? null,
        targetType: "expense",
        targetId: id,
        metadata: { before: pickExpenseFields(before) },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["month-profit"] });
      qc.invalidateQueries({ queryKey: ["expense-history"] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      amount?: number;
      category_id?: string | null;
      incurred_at?: string;
      description?: string | null;
    }) => {
      const { id, ...patch } = input;
      const { data: before } = await supabase
        .from("expenses" as any).select("*").eq("id", id).maybeSingle();
      const { error } = await supabase.from("expenses" as any).update(patch as any).eq("id", id);
      if (error) throw error;
      const changes = diffFields(pickExpenseFields(before), patch);
      if (Object.keys(changes).length > 0) {
        await logAudit({
          action: "expense.updated",
          tenantId: (before as any)?.tenant_id ?? tenantId ?? null,
          targetType: "expense",
          targetId: id,
          metadata: { kind: (before as any)?.kind ?? null, changes },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-drafts"] });
      qc.invalidateQueries({ queryKey: ["month-profit"] });
      qc.invalidateQueries({ queryKey: ["month-expense-breakdown"] });
      qc.invalidateQueries({ queryKey: ["expense-history"] });
    },
  });
}

export function useUpsertCategory() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: Partial<ExpenseCategory> & { name: string; kind: "fijo" | "variable" }) => {
      if (!tenantId) throw new Error("Sin tenant");
      if (input.id) {
        const { error } = await supabase.from("expense_categories" as any)
          .update({ name: input.name, kind: input.kind, icon: input.icon ?? null, is_active: input.is_active ?? true } as any)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expense_categories" as any).insert({
          tenant_id: tenantId,
          name: input.name, kind: input.kind, icon: input.icon ?? null,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
      qc.invalidateQueries({ queryKey: ["expense-categories-all"] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_categories" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
      qc.invalidateQueries({ queryKey: ["expense-categories-all"] });
    },
  });
}

export function useUpdateGoals() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: {
      monthly_goal_total: number;
      monthly_goal_by_type: { venta: number; servicio: number; refaccion: number };
      count_business_days: boolean;
      profit_thresholds?: { green: number; yellow: number; orange: number };
    }) => {
      if (!tenantId) throw new Error("Sin tenant");
      const { error } = await supabase.from("tenants").update(input as any).eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["run-rate"] });
      qc.invalidateQueries({ queryKey: ["tenant-goals"] });
      qc.invalidateQueries({ queryKey: ["month-profit"] });
    },
  });
}

export function useTenantGoals() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["tenant-goals", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("monthly_goal_total, monthly_goal_by_type, count_business_days, profit_thresholds")
        .eq("id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function formatMXN0(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

// ================ Metas mensuales (historial por mes) ================

// ================ Utilidades de periodo ================

function currentPeriodStart() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function isPastPeriod(year: number, month: number) {
  const c = currentPeriodStart();
  return year < c.year || (year === c.year && month < c.month);
}

// ================ Recurring expenses (fijos mensuales) ================

export function useRecurringExpenses() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["recurring-expenses", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_expenses" as any)
        .select("*")
        .order("day_of_month", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RecurringExpense[];
    },
  });
}

export function useUpsertRecurring() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: Partial<RecurringExpense> & { amount: number; day_of_month: number; category_id: string | null }) => {
      if (!tenantId) throw new Error("Sin tenant");
      if (input.id) {
        const { data: before } = await supabase
          .from("recurring_expenses" as any).select("*").eq("id", input.id).maybeSingle();
        const { error } = await supabase.from("recurring_expenses" as any).update({
          amount: input.amount, day_of_month: input.day_of_month,
          category_id: input.category_id, description: input.description ?? null,
          is_active: input.is_active ?? true,
        } as any).eq("id", input.id);
        if (error) throw error;
        const changes = diffFields(
          {
            amount: (before as any)?.amount, day_of_month: (before as any)?.day_of_month,
            category_id: (before as any)?.category_id, description: (before as any)?.description,
            is_active: (before as any)?.is_active,
          },
          {
            amount: input.amount, day_of_month: input.day_of_month,
            category_id: input.category_id, description: input.description ?? null,
            is_active: input.is_active ?? true,
          },
        );
        if (Object.keys(changes).length > 0) {
          await logAudit({
            action: "recurring_expense.updated",
            tenantId,
            targetType: "recurring_expense",
            targetId: input.id,
            metadata: { changes },
          });
        }
      } else {
        const { data, error } = await supabase.from("recurring_expenses" as any).insert({
          tenant_id: tenantId,
          amount: input.amount, day_of_month: input.day_of_month,
          category_id: input.category_id, description: input.description ?? null,
        } as any).select("id").single();
        if (error) throw error;
        await logAudit({
          action: "recurring_expense.created",
          tenantId,
          targetType: "recurring_expense",
          targetId: (data as any)?.id ?? null,
          metadata: {
            after: {
              amount: input.amount, day_of_month: input.day_of_month,
              category_id: input.category_id, description: input.description ?? null,
            },
          },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-expenses"] });
      qc.invalidateQueries({ queryKey: ["expense-history"] });
    },
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: before } = await supabase
        .from("recurring_expenses" as any).select("*").eq("id", id).maybeSingle();
      const { error } = await supabase.from("recurring_expenses" as any).delete().eq("id", id);
      if (error) throw error;
      await logAudit({
        action: "recurring_expense.deleted",
        tenantId: (before as any)?.tenant_id ?? tenantId ?? null,
        targetType: "recurring_expense",
        targetId: id,
        metadata: {
          before: {
            amount: (before as any)?.amount ?? null,
            day_of_month: (before as any)?.day_of_month ?? null,
            category_id: (before as any)?.category_id ?? null,
            description: (before as any)?.description ?? null,
          },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-expenses"] });
      qc.invalidateQueries({ queryKey: ["expense-history"] });
    },
  });
}

// ================ Expense rules (por deal ganado) ================

export function useExpenseRules() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["expense-rules", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_rules" as any)
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ExpenseRule[];
    },
  });
}

export function useUpsertRule() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: Partial<ExpenseRule> & { name: string; rule_type: RuleType; value: number; category_id: string | null }) => {
      if (!tenantId) throw new Error("Sin tenant");
      const payload: any = {
        name: input.name, rule_type: input.rule_type, value: input.value,
        category_id: input.category_id, deal_type_filter: input.deal_type_filter ?? null,
        auto_confirm: input.auto_confirm ?? false, is_active: input.is_active ?? true,
      };
      if (input.id) {
        const { error } = await supabase.from("expense_rules" as any).update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expense_rules" as any).insert({ tenant_id: tenantId, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense-rules"] }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_rules" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense-rules"] }),
  });
}
export interface ExpenseBreakdown {
  fijo: number;
  variable: number;
  total: number;
  bySeller: { userId: string | null; name: string; amount: number }[];
  scopedToMe: boolean;
}

/**
 * Breakdown of the current month's confirmed expenses.
 * Admins/managers see fixed vs variable and the split per seller;
 * a sales rep only sees their own expenses.
 */
export function useMonthExpenseBreakdown() {
  const { data: tenantId } = useTenantId();
  const { user } = useAuth();
  const { isTenantAdmin, isManager, isPlatform } = usePermissions();
  const { data: users } = useTenantUsers();
  const canSeeTeam = isTenantAdmin || isManager || isPlatform;

  return useQuery({
    queryKey: ["month-expense-breakdown", tenantId, user?.id, canSeeTeam, users?.length ?? 0],
    enabled: !!tenantId && !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<ExpenseBreakdown> => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("expenses" as any)
        .select("amount,kind,owner_id,deal_id")
        .eq("status", "confirmed")
        .gte("incurred_at", from)
        .lte("incurred_at", to);
      if (error) throw error;
      const rows = ((data as any[]) ?? []);

      // Resolve owner through the linked deal when the expense has no owner.
      const dealIds = Array.from(new Set(rows.map((r) => r.deal_id).filter(Boolean)));
      const dealOwner = new Map<string, string | null>();
      if (dealIds.length) {
        const { data: deals } = await supabase.from("deals").select("id,owner_id").in("id", dealIds as string[]);
        (deals ?? []).forEach((d: any) => dealOwner.set(d.id, d.owner_id ?? null));
      }

      const ownerOf = (r: any): string | null =>
        r.owner_id ?? (r.deal_id ? dealOwner.get(r.deal_id) ?? null : null);

      const scoped = canSeeTeam ? rows : rows.filter((r) => ownerOf(r) === user!.id);

      let fijo = 0, variable = 0;
      const perSeller = new Map<string | null, number>();
      for (const r of scoped) {
        const amt = Number(r.amount ?? 0);
        if (r.kind === "fijo") fijo += amt; else variable += amt;
        const oid = ownerOf(r);
        perSeller.set(oid, (perSeller.get(oid) ?? 0) + amt);
      }

      const bySeller = Array.from(perSeller.entries())
        .map(([userId, amount]) => ({
          userId,
          name: userId ? (users?.find((u) => u.id === userId)?.name ?? "Usuario") : "Sin asignar / general",
          amount,
        }))
        .sort((a, b) => b.amount - a.amount);

      return { fijo, variable, total: fijo + variable, bySeller, scopedToMe: !canSeeTeam };
    },
  });
}

// ================ Historial de cambios de gastos ================

export interface ExpenseHistoryEntry extends AuditEntry {}

const EXPENSE_ACTIONS = [
  "expense.created", "expense.updated", "expense.deleted", "expense.confirmed",
  "recurring_expense.created", "recurring_expense.updated", "recurring_expense.deleted",
];

/** Historial de un gasto o plantilla recurrente en particular. */
export function useExpenseHistory(targetId: string | null | undefined) {
  return useQuery({
    queryKey: ["expense-history", targetId],
    enabled: !!targetId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("target_id", targetId!)
        .in("action", EXPENSE_ACTIONS)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ExpenseHistoryEntry[];
    },
  });
}

/** Historial completo de gastos del tenant (solo admin/gerente lo consulta). */
export function useExpensesAuditLog(limit = 100) {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["expense-history", "tenant", tenantId, limit],
    enabled: !!tenantId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("tenant_id", tenantId!)
        .in("action", EXPENSE_ACTIONS)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as ExpenseHistoryEntry[];
    },
  });
}

export const EXPENSE_ACTION_LABEL: Record<string, string> = {
  "expense.created": "Gasto registrado",
  "expense.updated": "Gasto editado",
  "expense.deleted": "Gasto eliminado",
  "expense.confirmed": "Gasto confirmado",
  "recurring_expense.created": "Plantilla fija creada",
  "recurring_expense.updated": "Plantilla fija editada",
  "recurring_expense.deleted": "Plantilla fija eliminada",
};

export const EXPENSE_FIELD_LABEL: Record<string, string> = {
  amount: "Monto",
  category_id: "Categoría",
  incurred_at: "Fecha",
  description: "Descripción",
  status: "Estado",
  kind: "Tipo",
  day_of_month: "Día del mes",
  is_active: "Activa",
};
