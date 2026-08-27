import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { fetchTenant, updateTenant, uploadTenantLogo } from "@/services/tenant";
import { applyBrandPrimary, hexToHsl, hslToHex } from "@/lib/branding";
import { logAudit } from "@/services/audit";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2, Upload } from "lucide-react";
import { Logo } from "@/components/walix/Logo";
import { TenantMark } from "@/components/walix/TenantMark";

const TIMEZONES = [
  "America/Mexico_City", "America/Tijuana", "America/Cancun", "America/Bogota",
  "America/Lima", "America/Santiago", "America/Buenos_Aires", "America/New_York", "Europe/Madrid",
];
const CURRENCIES = ["MXN", "USD", "EUR", "COP", "ARS", "CLP", "PEN"];

export function GeneralTab({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isTenantAdmin, isSuperAdmin } = usePermissions();
  const canEdit = isTenantAdmin || isSuperAdmin;

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => fetchTenant(tenantId),
  });

  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [tz, setTz] = useState("America/Mexico_City");
  const [currency, setCurrency] = useState("MXN");
  const [color, setColor] = useState<string>("#5b6cf7");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [featureRecurrences, setFeatureRecurrences] = useState(true);
  const [featureExpenses, setFeatureExpenses] = useState(true);
  const [featureDealTypes, setFeatureDealTypes] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name);
    setBrandName(tenant.brand_name ?? "");
    setTz(tenant.timezone);
    setCurrency(tenant.currency);
    setLogoUrl(tenant.logo_url);
    setFeatureRecurrences(tenant.feature_recurrences ?? true);
    setFeatureExpenses(tenant.feature_expenses ?? true);
    setFeatureDealTypes(tenant.feature_deal_types ?? true);
    if (tenant.brand_primary) {
      setColor(hslToHex(tenant.brand_primary));
      applyBrandPrimary(tenant.brand_primary);
    }
  }, [tenant]);


  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadTenantLogo(tenantId, file);
      setLogoUrl(url);
      toast({ title: "Logo subido", description: "Recuerda guardar los cambios." });
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Error subiendo logo";
      toast({ title: "Error", description: m, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const brand_primary = hexToHsl(color);
      await updateTenant(tenantId, {
        name,
        brand_name: brandName || null,
        timezone: tz,
        currency,
        brand_primary,
        logo_url: logoUrl,
        feature_recurrences: featureRecurrences,
        feature_expenses: featureExpenses,
        feature_deal_types: featureDealTypes,
      });
      applyBrandPrimary(brand_primary);
      await logAudit({
        action: "tenant.updated",
        tenantId,
        targetType: "tenant",
        targetId: tenantId,
        metadata: { name, currency, timezone: tz, brand_primary, feature_recurrences: featureRecurrences, feature_expenses: featureExpenses, feature_deal_types: featureDealTypes },
      });
      qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
      qc.invalidateQueries({ queryKey: ["tenant-features"] });
      toast({ title: "Cambios guardados" });
    } catch (err: unknown) {

      const m = err instanceof Error ? err.message : "Error guardando";
      toast({ title: "Error", description: m, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <Card className="p-8 text-sm text-muted-foreground">Cargando...</Card>;

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Información de la empresa</h2>
          <p className="text-sm text-muted-foreground">Datos básicos de tu instancia.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la empresa</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brandName">Nombre del CRM (opcional)</Label>
            <Input
              id="brandName"
              placeholder="Ej. Acme CRM"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Zona horaria</Label>
            <Select value={tz} onValueChange={setTz} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Moneda</Label>
            <Select value={currency} onValueChange={setCurrency} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Marca</h2>
          <p className="text-sm text-muted-foreground">Logo y color principal de tu instancia.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-2xl border border-border bg-muted grid place-items-center overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">Sin logo</span>
            )}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={!canEdit || uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Subir logo
            </Button>
            <p className="text-xs text-muted-foreground mt-1">PNG o JPG, máx. 2 MB.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Color primario</Label>
          <div className="flex items-center gap-3">
            <input
              id="color"
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                applyBrandPrimary(hexToHsl(e.target.value));
              }}
              disabled={!canEdit}
              className="h-10 w-16 rounded-lg border border-border bg-background cursor-pointer disabled:opacity-50"
            />
            <code className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">{color}</code>
            <span className="text-xs text-muted-foreground">Vista previa en vivo. Guarda para hacerlo permanente.</span>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <div>
            <Label>Cómo se verá dentro de Walix</Label>
            <p className="text-xs text-muted-foreground">
              Tu logo siempre va contenido en un chip de tamaño fijo, junto a la marca Walix. Si no hay logo, usamos un monograma con tus iniciales.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-3 space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Barra lateral</p>
              <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-2">
                <Logo />
                <span className="text-muted-foreground">/</span>
                <TenantMark name={name} logoUrl={logoUrl} size={32} />
                <span className="text-sm font-medium truncate">{brandName || name || "Mi empresa"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-border p-3 space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Selector de instancia</p>
              <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-2">
                <TenantMark name={name} logoUrl={logoUrl} size={24} />
                <span className="text-sm truncate">{name || "Mi empresa"}</span>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <TenantMark name={name} logoUrl={null} size={32} />
                <span className="text-xs text-muted-foreground">Respaldo sin logo (monograma)</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="pointer-events-none">Botón primario</Button>
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">Chip de acento</span>
            <span className="text-xs text-muted-foreground">El color de marca solo pinta acentos, nunca fondos grandes.</span>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Módulos activos</h2>
          <p className="text-sm text-muted-foreground">Activa o desactiva funciones de Walix para este tenant.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="f-recurrences">Servicios y recurrencias</Label>
              <p className="text-xs text-muted-foreground">Mantenimientos, suscripciones y agenda.</p>
            </div>
            <Switch
              id="f-recurrences"
              checked={featureRecurrences}
              onCheckedChange={setFeatureRecurrences}
              disabled={!canEdit}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="f-expenses">Gastos y rentabilidad</Label>
              <p className="text-xs text-muted-foreground">Módulo de gastos y widgets de rentabilidad.</p>
            </div>
            <Switch
              id="f-expenses"
              checked={featureExpenses}
              onCheckedChange={setFeatureExpenses}
              disabled={!canEdit}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="f-dealtypes">Tipos de oportunidad</Label>
              <p className="text-xs text-muted-foreground">Venta/servicio/refacción personalizados.</p>
            </div>
            <Switch
              id="f-dealtypes"
              checked={featureDealTypes}
              onCheckedChange={setFeatureDealTypes}
              disabled={!canEdit}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">

        <Button onClick={handleSave} disabled={!canEdit || saving} className="min-w-[160px]">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}