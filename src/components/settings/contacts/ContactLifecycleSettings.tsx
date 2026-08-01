import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useTenant, useUpdateTenant } from "@/lib/queries/tenant";

const INACTIVITY_DAYS_OPTIONS = [30, 90, 120, 150, 180];
const CUSTOMER_INACTIVITY_MONTHS_OPTIONS = [3, 6, 9, 12];

export function ContactLifecycleSettings() {
  const { data: tenant } = useTenant();
  const update = useUpdateTenant();

  const [contactInactivityDays, setContactInactivityDays] = useState<number>(90);
  const [customerInactivityMonths, setCustomerInactivityMonths] = useState<number>(6);

  useEffect(() => {
    if (tenant) {
      setContactInactivityDays(tenant.contactInactivityDays);
      setCustomerInactivityMonths(tenant.customerInactivityMonths);
    }
  }, [tenant]);

  if (!tenant) return null;

  const handleSave = () => {
    update.mutate(
      {
        id: tenant.id,
        patch: {
          contact_inactivity_days: contactInactivityDays,
          customer_inactivity_months: customerInactivityMonths,
        },
      },
      {
        onSuccess: () => toast.success("Configuración de ciclo de vida guardada"),
        onError: () => toast.error("No se pudo guardar la configuración"),
      },
    );
  };

  const hasChanges =
    contactInactivityDays !== tenant.contactInactivityDays ||
    customerInactivityMonths !== tenant.customerInactivityMonths;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ciclo de vida del contacto</CardTitle>
        <CardDescription>
          Configura cuándo un contacto pasa automáticamente a inactivo o a cliente ya inactivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact-inactivity-days">Días para inactivar un prospecto</Label>
            <Select
              value={String(contactInactivityDays)}
              onValueChange={(v) => setContactInactivityDays(Number(v))}
            >
              <SelectTrigger id="contact-inactivity-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INACTIVITY_DAYS_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} días
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Si un prospecto no tiene actividad en este periodo, pasará a <strong>Inactivo</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-inactivity-months">Meses para cliente ya inactivo</Label>
            <Select
              value={String(customerInactivityMonths)}
              onValueChange={(v) => setCustomerInactivityMonths(Number(v))}
            >
              <SelectTrigger id="customer-inactivity-months">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_INACTIVITY_MONTHS_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} meses
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Si un cliente no compra en este periodo, pasará a <strong>Cliente ya inactivo</strong>.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!hasChanges || update.isPending}>
            {update.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
