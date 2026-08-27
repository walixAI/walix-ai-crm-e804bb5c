import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Package, Plus, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useProductCategories, useCreateProductCategory, useDeleteProductCategory, useUpdateProductCategory,
} from "@/lib/queries/monthlyGoals";
import { useTenantFeatures } from "@/lib/queries/tenantFeatures";

export function ProductCategoriesCard() {
  const { data: features } = useTenantFeatures();
  const featureRecurrences = features?.feature_recurrences ?? true;
  const { data: categories = [], isLoading } = useProductCategories();
  const create = useCreateProductCategory();
  const del = useDeleteProductCategory();
  const update = useUpdateProductCategory();
  const [name, setName] = useState("");

  async function onAdd() {
    const n = name.trim();
    if (!n) return;
    try {
      await create.mutateAsync(n);
      setName("");
      toast.success("Categoría creada");
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo crear");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" /> Categorías / productos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Crea categorías propias (ej. "Producto A", "Plan anual") para definir metas por producto o línea de negocio.
          {featureRecurrences && (
            <>
              {" "}Marca una categoría como <strong>servicio recurrente</strong> para que cada oportunidad genere
              automáticamente la suscripción y los ciclos futuros del cliente.
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Nombre de la categoría"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
          />
          <Button onClick={onAdd} disabled={create.isPending || !name.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Cargando...</div>
        ) : categories.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">Sin categorías todavía.</div>
        ) : (
          <div className="divide-y divide-border rounded-md border">
            {categories.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 min-w-[120px]">{c.name}</span>
                <div className="flex items-center gap-2">
                  <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Recurrente</span>
                  <Switch
                    checked={!!c.is_recurring}
                    onCheckedChange={(v) =>
                      update.mutate(
                        { id: c.id, is_recurring: v, default_period_months: v ? (c.default_period_months ?? 12) : null },
                        { onSuccess: () => toast.success(v ? "Categoría marcada como recurrente" : "Recurrencia desactivada") },
                      )
                    }
                  />
                </div>
                {c.is_recurring && (
                  <Select
                    value={String(c.default_period_months ?? 12)}
                    onValueChange={(v) =>
                      update.mutate({ id: c.id, default_period_months: Number(v) }, {
                        onSuccess: () => toast.success("Periodicidad actualizada"),
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Mensual</SelectItem>
                      <SelectItem value="3">Trimestral</SelectItem>
                      <SelectItem value="6">Semestral</SelectItem>
                      <SelectItem value="12">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="ghost" size="sm"
                  onClick={() => del.mutate(c.id, { onSuccess: () => toast.success("Eliminada") })}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}