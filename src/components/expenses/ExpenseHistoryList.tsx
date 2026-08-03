import { History } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  useExpenseHistory, useExpensesAuditLog, useAllExpenseCategories,
  EXPENSE_ACTION_LABEL, EXPENSE_FIELD_LABEL, formatMXN0,
  type ExpenseHistoryEntry,
} from "@/lib/queries/expenses";

interface Props {
  /** Historial de un gasto o plantilla específica. Omitir para ver todo el tenant. */
  targetId?: string | null;
  limit?: number;
  emptyLabel?: string;
}

export function ExpenseHistoryList({ targetId, limit = 30, emptyLabel = "Sin cambios registrados." }: Props) {
  const single = useExpenseHistory(targetId ?? null);
  const tenantWide = useExpensesAuditLog(limit);
  const { data: cats = [] } = useAllExpenseCategories();
  const query = targetId ? single : tenantWide;
  const entries = (query.data ?? []) as ExpenseHistoryEntry[];

  const fmt = (field: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    if (field === "amount") return formatMXN0(Number(value));
    if (field === "category_id") return cats.find(c => c.id === value)?.name ?? "Categoría";
    if (field === "incurred_at") return format(new Date(`${value}T00:00:00`), "dd MMM yyyy", { locale: es });
    if (field === "is_active") return value ? "Sí" : "No";
    return String(value);
  };

  if (query.isLoading) return <div className="text-xs text-muted-foreground">Cargando historial...</div>;
  if (entries.length === 0) return <div className="text-xs text-muted-foreground">{emptyLabel}</div>;

  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const meta = (e.metadata ?? {}) as any;
        const changes = (meta.changes ?? {}) as Record<string, { before: unknown; after: unknown }>;
        return (
          <div key={e.id} className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-semibold">{EXPENSE_ACTION_LABEL[e.action] ?? e.action}</span>
              <span className="text-muted-foreground truncate">
                {format(new Date(e.created_at), "dd MMM yyyy · HH:mm", { locale: es })}
                {e.actor_email ? ` · ${e.actor_email}` : ""}
              </span>
            </div>
            {Object.keys(changes).length > 0 && (
              <ul className="mt-1 space-y-0.5 pl-6">
                {Object.entries(changes).map(([field, c]) => (
                  <li key={field}>
                    <span className="text-muted-foreground">{EXPENSE_FIELD_LABEL[field] ?? field}: </span>
                    <span className="line-through text-muted-foreground">{fmt(field, c.before)}</span>
                    <span className="mx-1">→</span>
                    <span className="font-semibold">{fmt(field, c.after)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}