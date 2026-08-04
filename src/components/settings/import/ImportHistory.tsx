import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useImportBatches, useRevertImportBatch } from "@/lib/queries/import";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { RotateCcw, CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";

export function ImportHistory() {
  const { data: batches = [], isLoading } = useImportBatches();
  const revert = useRevertImportBatch();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de importaciones</CardTitle>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay importaciones.</p>
        ) : (
          <div className="space-y-3">
            {batches.map((b) => (
              <div
                key={b.id}
                className="flex items-start justify-between gap-4 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{b.fileName ?? "Sin nombre"}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted uppercase">{b.kind}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(b.createdAt), "PPp", { locale: es })} · {b.totalRows} filas
                  </p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> {b.importedRows}
                    </span>
                    {b.errorRows > 0 && (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" /> {b.errorRows}
                      </span>
                    )}
                    {b.skippedRows > 0 && (
                      <span className="flex items-center gap-1 text-amber-500">
                        <XCircle className="h-3.5 w-3.5" /> {b.skippedRows}
                      </span>
                    )}
                  </div>
                </div>
                {b.status !== "reverted" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revert.isPending}
                    onClick={async () => {
                      try {
                        await revert.mutateAsync(b.id);
                        toast({ title: "Importe revertido" });
                      } catch (e: any) {
                        toast({ title: "Error", description: e?.message ?? "", variant: "destructive" });
                      }
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Deshacer
                  </Button>
                )}
                {b.status === "reverted" && (
                  <span className="text-xs text-muted-foreground">Revertido</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
