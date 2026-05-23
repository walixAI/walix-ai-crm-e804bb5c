import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ExternalLink, Loader2, CheckCircle2, AlertCircle, XCircle, ShieldCheck } from "lucide-react";
import { useDiscoverWaba, useConnectDiscovered, type DiscoveredBusiness, type DiscoveredPhone } from "@/lib/queries/whatsappDiscovery";
import type { ChannelKind } from "@/lib/queries/whatsappChannels";
import { toast } from "sonner";

const META_APP_ID = "2488795184889996";
const SHARE_URL = `https://business.facebook.com/settings/whatsapp-business-accounts?app_id=${META_APP_ID}`;
const TOKEN_HELP_URL = "https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#system-user";

interface Props {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  kind: ChannelKind;
}

type Step = 1 | 2 | 3 | 4;

function qualityBadge(q?: string) {
  const v = (q ?? "").toUpperCase();
  if (v === "GREEN") return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">Calidad alta</span>;
  if (v === "YELLOW") return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning">Calidad media</span>;
  if (v === "RED") return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Calidad baja</span>;
  return null;
}

function StepDot({ state }: { state: "idle" | "running" | "ok" | "fail" }) {
  if (state === "ok") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (state === "fail") return <XCircle className="h-4 w-4 text-destructive" />;
  if (state === "running") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  return <span className="h-4 w-4 rounded-full border border-border inline-block" />;
}

export function ByoWabaWizard({ open, onClose, tenantId, kind }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [acked, setAcked] = useState(false);
  const [token, setToken] = useState("");
  const [businesses, setBusinesses] = useState<DiscoveredBusiness[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<{ waba_id: string; phone: DiscoveredPhone } | null>(null);
  const discover = useDiscoverWaba();
  const connect = useConnectDiscovered(tenantId);

  const flatPhones = useMemo(() => {
    const out: Array<{ waba_id: string; waba_name?: string; biz_name: string; phone: DiscoveredPhone }> = [];
    businesses.forEach((b) => b.wabas.forEach((w) => w.phones.forEach((p) => out.push({ waba_id: w.id, waba_name: w.name, biz_name: b.name, phone: p }))));
    return out;
  }, [businesses]);

  async function handleDiscover() {
    try {
      const r = await discover.mutateAsync(token);
      setBusinesses(r.businesses);
      if (r.summary.phones === 0) {
        toast.warning("No se encontraron números", { description: "Verifica que compartiste la WABA con Walix y que el token tiene los permisos correctos." });
        return;
      }
      if (r.summary.phones === 1) {
        const only = r.businesses.find((b) => b.wabas.find((w) => w.phones.length))!;
        const w = only.wabas.find((w) => w.phones.length)!;
        setSelectedPhone({ waba_id: w.id, phone: w.phones[0] });
      }
      setStep(3);
    } catch (e) {
      const err = e as Error & { code?: string; payload?: { missing?: string[] } };
      if (err.code === "missing_scope") {
        toast.error("Permisos faltantes", {
          description: `El token no incluye: ${err.payload?.missing?.join(", ")}. Regenera el System User Token marcando esos permisos.`,
        });
      } else if (err.code === "invalid_token") {
        toast.error("Token inválido", { description: err.message });
      } else {
        toast.error("No se pudo conectar", { description: err.message });
      }
    }
  }

  async function handleConnect() {
    if (!selectedPhone) return;
    try {
      const r = await connect.mutateAsync({
        token,
        waba_id: selectedPhone.waba_id,
        phone_number_id: selectedPhone.phone.id,
        kind,
      });
      toast.success("WhatsApp conectado", {
        description: r.test_message_sent
          ? `Mensaje de prueba enviado a ${r.phone_number ?? "tu número"}`
          : `${r.verified_name ?? r.phone_number ?? "Número"} listo (no se envió mensaje de prueba: revisa plantilla hello_world)`,
      });
      onClose();
      // reset
      setStep(1); setToken(""); setAcked(false); setSelectedPhone(null); setBusinesses([]);
    } catch (e) {
      toast.error("No se pudo completar la conexión", { description: (e as Error).message });
    }
  }

  const connectSteps = (connect.data?.steps ?? {}) as Record<string, { ok: boolean; detail?: string }>;
  function stateFor(key: string): "idle" | "running" | "ok" | "fail" {
    if (connect.isPending && step === 4) return key in connectSteps ? (connectSteps[key].ok ? "ok" : "fail") : "running";
    if (!connect.data) return "idle";
    return connectSteps[key]?.ok ? "ok" : key in connectSteps ? "fail" : "idle";
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp · Asistente BYO-WABA</DialogTitle>
          <DialogDescription>
            Conecta tu cuenta de WhatsApp Business compartiéndola con Walix. Sin login de Facebook.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4 text-sm">
            <p className="font-medium">Paso 1 — Comparte tu WABA con Walix</p>
            <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
              <li>Abre <b>Business Settings</b> de tu Business Manager.</li>
              <li>Ve a <b>Accounts → WhatsApp Accounts</b>, selecciona tu WABA.</li>
              <li>En "Assigned Assets" o "Partners", añade la app <code className="text-foreground">{META_APP_ID}</code> (Walix) con permisos completos sobre la WABA.</li>
              <li>En <b>System Users</b>, crea (o reutiliza) un System User y asígnale la WABA con <b>permisos completos</b>. Genera un <b>token permanente</b> con los permisos: <code className="text-foreground">whatsapp_business_messaging</code>, <code className="text-foreground">whatsapp_business_management</code>.</li>
            </ol>
            <a
              href={SHARE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
            >
              Abrir Business Settings <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40">
              <Checkbox id="ack" checked={acked} onCheckedChange={(v) => setAcked(!!v)} />
              <Label htmlFor="ack" className="text-sm leading-relaxed cursor-pointer">
                Ya compartí mi WABA con la app de Walix y generé un System User Token.
              </Label>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button disabled={!acked} onClick={() => setStep(2)}>Continuar</Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 text-sm">
            <p className="font-medium">Paso 2 — Pega tu System User Token</p>
            <div className="space-y-2">
              <Label className="text-xs">System User Token (permanente)</Label>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="EAAG..."
                className="font-mono"
              />
              <a
                href={TOKEN_HELP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                ¿Cómo genero un System User Token? <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/40">
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
              Validaremos el token contra Meta y solo te mostraremos las cuentas y números a los que tienes acceso. No publicamos nada todavía.
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(1)}>Atrás</Button>
              <Button onClick={handleDiscover} disabled={!token.trim() || discover.isPending}>
                {discover.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Descubrir mis cuentas
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-sm">
            <p className="font-medium">Paso 3 — Selecciona el número a conectar</p>
            {flatPhones.length === 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 text-warning">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>No encontramos números. Vuelve atrás y verifica que la WABA esté compartida con Walix.</span>
              </div>
            ) : (
              <RadioGroup
                value={selectedPhone ? `${selectedPhone.waba_id}:${selectedPhone.phone.id}` : ""}
                onValueChange={(v) => {
                  const [waba_id, phone_id] = v.split(":");
                  const found = flatPhones.find((p) => p.waba_id === waba_id && p.phone.id === phone_id);
                  if (found) setSelectedPhone({ waba_id: found.waba_id, phone: found.phone });
                }}
              >
                <Accordion type="multiple" defaultValue={businesses.map((b) => b.id)} className="space-y-2">
                  {businesses.map((b) => (
                    <AccordionItem key={b.id} value={b.id} className="border rounded-lg px-3">
                      <AccordionTrigger className="text-sm">
                        {b.name} <span className="text-xs text-muted-foreground ml-2">({b.wabas.length} WABA)</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pt-2">
                        {b.wabas.map((w) => (
                          <div key={w.id} className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              {w.name ?? "WABA"} {w.shared && <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-foreground">compartida</span>}
                            </div>
                            {w.phones.length === 0 && (
                              <p className="text-xs text-muted-foreground pl-2">Sin números registrados.</p>
                            )}
                            {w.phones.map((p) => {
                              const id = `${w.id}:${p.id}`;
                              return (
                                <label key={p.id} htmlFor={id} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
                                  <RadioGroupItem value={id} id={id} />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-mono text-sm">{p.display_phone_number}</div>
                                    <div className="text-xs text-muted-foreground truncate">{p.verified_name ?? "Sin nombre verificado"}</div>
                                  </div>
                                  {qualityBadge(p.quality_rating)}
                                </label>
                              );
                            })}
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </RadioGroup>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(2)}>Atrás</Button>
              <Button disabled={!selectedPhone} onClick={() => setStep(4)}>Continuar</Button>
            </DialogFooter>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 text-sm">
            <p className="font-medium">Paso 4 — Confirma y prueba la conexión</p>
            {selectedPhone && (
              <div className="p-3 rounded-lg border space-y-1">
                <div className="text-xs text-muted-foreground">Vas a conectar:</div>
                <div className="font-mono">{selectedPhone.phone.display_phone_number}</div>
                <div className="text-xs text-muted-foreground">{selectedPhone.phone.verified_name}</div>
              </div>
            )}
            <div className="space-y-2">
              {[
                ["subscribed_apps", "Suscribir webhook a la WABA"],
                ["register", "Registrar número en Cloud API"],
                ["metadata", "Leer metadata del número"],
                ["test_message", "Enviar mensaje de prueba (hello_world)"],
                ["saved", "Guardar canal en Walix"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <StepDot state={stateFor(key)} />
                  <span>{label}</span>
                  {connectSteps[key]?.detail && !connectSteps[key].ok && (
                    <span className="text-muted-foreground">— {connectSteps[key].detail}</span>
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(3)} disabled={connect.isPending}>Atrás</Button>
              <Button onClick={handleConnect} disabled={connect.isPending || !selectedPhone}>
                {connect.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {connect.data ? "Cerrar" : "Conectar y probar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}