import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantId } from "@/lib/queries/tenant";

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

export function useExpenses(filters: ExpenseFilters = {}) {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["expenses", tenantId, filters.month?.toISOString().slice(0, 7), filters.kind, filters.categoryId],
    enabled: !!tenantId,
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
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Expense[];
    },
  });
}

export function useDraftExpenses() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["expenses-drafts", tenantId],
    enabled: !!tenantId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses" as any)
        .select("*")
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Expense[];
    },
  });
}

export function useConfirmExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; amount?: number }) => {
      const patch: any = { status: "confirmed" };
      if (typeof input.amount === "number") patch.amount = input.amount;
      const { error } = await supabase.from("expenses" as any).update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-drafts"] });
      qc.invalidateQueries({ queryKey: ["month-profit"] });
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
      const { error } = await supabase.from("expenses" as any).insert({
        tenant_id: tenantId,
        owner_id: user.id,
        currency: "MXN",
        ...input,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["month-profit"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["month-profit"] });
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