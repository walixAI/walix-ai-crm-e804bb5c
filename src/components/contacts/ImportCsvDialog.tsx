import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";

const steps = ["Subir archivo", "Mapear columnas", "Vista previa", "Confirmar"];

export function ImportCsvDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [filename, setFilename] = useState<string | null>(null);

  const reset = () => { setStep(0); setFilename(null); };
  const close = () => { onOpenChange(false); setTimeout(reset, 200); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(true); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar contactos desde CSV</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`h-7 w-7 rounded-full grid place-items-center text-xs font-semibold ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === step ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
              {i < steps.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="py-4 min-h-[260px]">
          {step === 0 && (
            <label className="block border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Arrastra tu archivo CSV aquí o haz clic para seleccionar</p>
              <p className="text-xs text-muted-foreground mt-1">Máx. 10MB · UTF-8</p>
              <input type="file" accept=".csv" className="hidden" onChange={(e) => setFilename(e.target.files?.[0]?.name ?? "contactos.csv")} />
              {filename && <div className="mt-4 inline-flex items-center gap-2 text-sm text-primary"><FileText className="h-4 w-4" /> {filename}</div>}
            </label>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">Detectamos automáticamente estas columnas:</p>
              {[["nombre", "Nombre", true], ["telefono", "Teléfono", true], ["email", "Email", true], ["empresa", "Empresa", false]].map(([col, field, auto]: any) => (
                <div key={col} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Columna CSV</div>
                    <div className="font-mono text-sm">{col}</div>
                  </div>
                  <div className="text-muted-foreground">→</div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Campo Walix</div>
                    <div className="text-sm font-medium">{field}</div>
                  </div>
                  {auto && <span className="text-xs text-success font-medium">auto</span>}
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
                <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div><span className="font-medium">3 duplicados detectados</span> serán omitidos automáticamente.</div>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr><th className="text-left p-2">Nombre</th><th className="text-left p-2">Teléfono</th><th className="text-left p-2">Email</th></tr>
                  </thead>
                  <tbody>
                    {[["Lucía Hernández", "+52 55 1234 5678", "lucia@mail.mx"], ["Pedro García", "+52 55 9876 5432", "pedro@mail.mx"], ["Mariana Vega", "+52 55 5555 0001", "mariana@mail.mx"], ["Roberto Sánchez", "+52 81 2222 3333", "roberto@mail.mx"], ["Sofía López", "+52 33 4444 5555", "sofia@mail.mx"]].map((r, i) => (
                      <tr key={i} className="border-t border-border"><td className="p-2">{r[0]}</td><td className="p-2 font-mono text-xs">{r[1]}</td><td className="p-2">{r[2]}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-full bg-success/10 grid place-items-center mx-auto mb-4">
                <Check className="h-8 w-8 text-success" />
              </div>
              <h3 className="text-lg font-semibold">Listo para importar</h3>
              <p className="text-sm text-muted-foreground mt-2">Se importarán <span className="font-semibold text-foreground">142 contactos</span>, <span className="font-semibold text-foreground">3 duplicados</span> serán ignorados.</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>Atrás</Button>}
          {step < 3 && <Button onClick={() => setStep(step + 1)} disabled={step === 0 && !filename}>Continuar</Button>}
          {step === 3 && <Button onClick={() => { toast.success("142 contactos importados"); close(); }}>Importar contactos</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
