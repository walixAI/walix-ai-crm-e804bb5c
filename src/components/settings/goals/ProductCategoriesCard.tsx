import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useProductCategories, useCreateProductCategory, useDeleteProductCategory,
} from "@/lib/queries/monthlyGoals";

export function ProductCategoriesCard() {
  const { data: categories = [], isLoading } = useProductCategories();
  const create = useCreateProductCategory();
  const del = useDeleteProductCategory();
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
          Crea categorías propias (ej. "Refrigerador 36\"", "Mantenimiento anual") para poder definir metas por producto.
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
              <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{c.name}</span>
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