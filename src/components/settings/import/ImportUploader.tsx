import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCreateImportBatch, type ImportKind } from "@/lib/queries/import";
import { FileSpreadsheet, Upload, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface Props {
  kind: ImportKind;
  onPreview: (batchId: string) => void;
}

export function ImportUploader({ kind, onPreview }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const createBatch = useCreateImportBatch();

  const handleFile = useCallback(
    async (file: File) => {
      if (!file) return;
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
        toast({ title: "Formato no soportado", description: "Usa .xlsx, .xls o .csv", variant: "destructive" });
        return;
      }

      setParsing(true);
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(firstSheet, { defval: "" }) as Record<string, any>[];

        if (json.length === 0) {
          toast({ title: "Archivo vacío", description: "No se encontraron filas con datos.", variant: "destructive" });
          return;
        }

        const batch = await createBatch.mutateAsync({
          kind,
          fileName: file.name,
          fileSize: file.size,
          rows: json,
        });
        onPreview(batch.id);
      } catch (e: any) {
        toast({ title: "Error al leer el archivo", description: e?.message ?? "", variant: "destructive" });
      } finally {
        setParsing(false);
      }
    },
    [kind, onPreview, toast, createBatch]
  );

  return (
    <div
      className="border-2 border-dashed border-border rounded-xl p-8 text-center space-y-4 hover:bg-muted/40 transition-colors cursor-pointer"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <FileSpreadsheet className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="font-medium">Arrastra tu archivo aquí o haz clic para elegirlo</p>
        <p className="text-sm text-muted-foreground mt-1">Excel (.xlsx, .xls) o CSV. Máximo 5,000 filas.</p>
      </div>
      <Button type="button" disabled={parsing || createBatch.isPending}>
        {parsing || createBatch.isPending ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-1.5" />
        )}
        {parsing || createBatch.isPending ? "Leyendo..." : "Seleccionar archivo"}
      </Button>
    </div>
  );
}
