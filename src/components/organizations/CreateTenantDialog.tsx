import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import { createTenant } from "@/services/organizations";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const PLANS = [
  { value: "starter", label: "Starter", price: 0, desc: "1 usuario, sin automatizaciones" },
  { value: "pyme", label: "PYME", price: 990, desc: "5 usuarios, 3 automatizaciones" },
  { value: "growth", label: "Growth", price: 2490, desc: "15 usuarios, ilimitado" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
}

export function CreateTenantDialog({ open, onOpenChange, organizationId }: Props) {
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("pyme");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const onCreate = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Nombre requerido" });
      return;
    }
    setSubmitting(true);
    try {
      await createTenant({ organization_id: organizationId, name: name.trim(), plan });
      toast({
        title: "Empresa creada",
        description: `${name} está lista. Cambia a ella desde el selector.`,
      });
      qc.invalidateQueries({ queryKey: ["user"] });
      qc.invalidateQueries({ queryKey: ["org"] });
      onOpenChange(false);
      setName("");
      setPlan("pyme");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const selected = PLANS.find((p) => p.value === plan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear nueva empresa</DialogTitle>
          <DialogDescription>
            Cada empresa tiene sus propios datos, equipo y facturación independiente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tenant-name">Nombre de la empresa</Label>
            <Input
              id="tenant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Acme S.A."
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Plan inicial</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="font-medium">{p.label}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      ${p.price} MXN/mes — {p.desc}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Sin trial.</strong> Esta empresa se factura desde el día 1
              ({selected?.label}: ${selected?.price} MXN/mes).
              El trial gratuito solo aplica a tu primera empresa.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={onCreate} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear empresa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
