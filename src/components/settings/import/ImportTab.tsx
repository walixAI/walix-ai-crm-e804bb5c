import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useImportBatches, type ImportKind } from "@/lib/queries/import";
import { ImportUploader } from "./ImportUploader";
import { ImportPreview } from "./ImportPreview";
import { ImportHistory } from "./ImportHistory";
import { Upload, History } from "lucide-react";

type View = "upload" | "history";

const KINDS: { value: ImportKind; label: string }[] = [
  { value: "contacts", label: "Contactos" },
  { value: "products", label: "Productos" },
  { value: "deals", label: "Oportunidades" },
  { value: "activities", label: "Actividades" },
];

export function ImportTab() {
  const { toast } = useToast();
  const [view, setView] = useState<View>("upload");
  const [kind, setKind] = useState<ImportKind>("contacts");
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const { data: batches = [] } = useImportBatches();

  const activeBatch = batches.find((b) => b.id === activeBatchId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Importar datos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sube contactos, productos, oportunidades o actividades desde Excel o CSV.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={view === "upload" ? "default" : "outline"} onClick={() => setView("upload")}>
            <Upload className="h-4 w-4 mr-1.5" /> Nuevo importe
          </Button>
          <Button variant={view === "history" ? "default" : "outline"} onClick={() => setView("history")}>
            <History className="h-4 w-4 mr-1.5" /> Historial
          </Button>
        </div>
      </div>

      {view === "upload" && !activeBatchId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Elige qué vas a importar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={kind} onValueChange={(v) => setKind(v as ImportKind)}>
              <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-auto">
                {KINDS.map((k) => (
                  <TabsTrigger key={k.value} value={k.value}>
                    {k.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <ImportUploader
              kind={kind}
              onPreview={(batchId) => {
                setActiveBatchId(batchId);
              }}
            />
          </CardContent>
        </Card>
      )}

      {view === "upload" && activeBatchId && activeBatch && (
        <ImportPreview
          batch={activeBatch}
          onBack={() => setActiveBatchId(null)}
          onDone={() => {
            setActiveBatchId(null);
            setView("history");
            toast({ title: "Importe completado" });
          }}
        />
      )}

      {view === "history" && <ImportHistory />}
    </div>
  );
}
