import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useImportRows, useConfirmImport, type ImportBatch, type ImportKind } from "@/lib/queries/import";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  batch: ImportBatch;
  onBack: () => void;
  onDone: () => void;
}

const FIELD_SUGGESTIONS: Record<ImportKind, { value: string; label: string; required?: boolean }[]> = {
  contacts: [
    { value: "name", label: "Nombre", required: true },
    { value: "last_name", label: "Apellidos" },
    { value: "phone", label: "Teléfono", required: true },
    { value: "phone_alt", label: "Teléfono alterno" },
    { value: "email", label: "Correo" },
    { value: "company", label: "Empresa" },
    { value: "address", label: "Dirección" },
    { value: "source", label: "Fuente" },
    { value: "lifecycle", label: "Ciclo de vida" },
    { value: "owner_email", label: "Email del responsable" },
  ],
  products: [
    { value: "name", label: "Nombre", required: true },
    { value: "sku", label: "SKU" },
    { value: "price", label: "Precio" },
    { value: "category", label: "Categoría" },
  ],
  deals: [
    { value: "name", label: "Nombre de la oportunidad", required: true },
    { value: "contact_phone", label: "Teléfono del contacto", required: true },
    { value: "amount", label: "Monto" },
    { value: "stage_name", label: "Etapa", required: true },
    { value: "owner_email", label: "Email del responsable" },
    { value: "close_date", label: "Fecha estimada de cierre" },
  ],
  activities: [
    { value: "contact_phone", label: "Teléfono del contacto", required: true },
    { value: "type", label: "Tipo" },
    { value: "direction", label: "Dirección" },
    { value: "description", label: "Descripción" },
    { value: "occurred_at", label: "Fecha" },
    { value: "owner_email", label: "Email del responsable" },
  ],
};

function suggestMapping(headers: string[], kind: ImportKind): Record<string, string> {
  const suggestions: Record<string, string> = {};
  const fields = FIELD_SUGGESTIONS[kind];
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  fields.forEach((f) => {
    const idx = lowerHeaders.findIndex((h) =>
      h.includes(f.value.toLowerCase()) ||
      h.includes(f.label.toLowerCase()) ||
      (f.value === "phone" && (h.includes("telefono") || h.includes("teléfono") || h.includes("celular") || h.includes("mobile"))) ||
      (f.value === "name" && (h.includes("nombre") || h.includes("name"))) ||
      (f.value === "last_name" && (h.includes("apellido") || h.includes("last"))) ||
      (f.value === "address" && (h.includes("direccion") || h.includes("dirección") || h.includes("domicilio"))) ||
      (f.value === "occurred_at" && (h.includes("fecha") || h.includes("date"))) ||
      (f.value === "amount" && (h.includes("monto") || h.includes("amount") || h.includes("valor")))
    );
    if (idx >= 0) suggestions[f.value] = headers[idx];
  });
  return suggestions;
}

export function ImportPreview({ batch, onBack, onDone }: Props) {
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useImportRows(batch.id);
  const confirmImport = useConfirmImport();
  const [mappings, setMappings] = useState<Record<string, string>>({});

  const headers = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0].rawData);
  }, [rows]);

  const suggested = useMemo(() => suggestMapping(headers, batch.kind), [headers, batch.kind]);

  const previewRows = rows.slice(0, 5);
  const requiredFields = FIELD_SUGGESTIONS[batch.kind].filter((f) => f.required).map((f) => f.value);
  const missingRequired = requiredFields.filter((f) => !mappings[f] && !suggested[f]);

  const handleConfirm = async () => {
    if (missingRequired.length > 0) {
      toast({
        title: "Faltan campos obligatorios",
        description: `Mapea: ${missingRequired.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    try {
      await confirmImport.mutateAsync({ batchId: batch.id, mappings: { ...suggested, ...mappings } });
      onDone();
    } catch (e: any) {
      toast({ title: "Error al importar", description: e?.message ?? "", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Elegir otro archivo
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Mapeo de columnas — {batch.fileName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {FIELD_SUGGESTIONS[batch.kind].map((field) => {
              const suggestedHeader = suggested[field.value];
              const current = mappings[field.value] ?? suggestedHeader ?? "";
              return (
                <div key={field.value} className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-destructive">*</span>}
                    {suggestedHeader && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                  </label>
                  <Select
                    value={current}
                    onValueChange={(v) => setMappings((prev) => ({ ...prev, [field.value]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Columna del archivo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">(ignorar)</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          {missingRequired.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Faltan campos obligatorios por mapear: {missingRequired.join(", ")}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vista previa ({rows.length} filas)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.id} className="border-t">
                    {headers.map((h) => (
                      <td key={h} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate">
                        {String(row.rawData[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm} disabled={confirmImport.isPending}>
          {confirmImport.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          Confirmar e importar
        </Button>
      </div>
    </div>
  );
}
