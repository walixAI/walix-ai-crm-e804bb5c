import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WBadge } from "@/components/walix/Badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Cpu, Send } from "lucide-react";
import { useAiModelCatalog, useModelChangeRequests, useRequestModelChange } from "@/lib/queries/aiModels";
import { usePlanLimits } from "@/lib/queries/planLimits";
import { aiVendorLabel } from "@/lib/plans";
import { toast } from "sonner";

const STATUS: Record<string, { label: string; variant: "brand" | "success" | "danger" | "warning" }> = {
  pending: { label: "En revisión", variant: "warning" },
  approved: { label: "Aprobada", variant: "success" },
  rejected: { label: "Rechazada", variant: "danger" },
};

export function AiEngineCard({
  tenantId, plan, vendor, model,
}: { tenantId: string; plan: string; vendor: string | null; model: string | null }) {
  const { data: catalog = [] } = useAiModelCatalog();
  const { data: limits } = usePlanLimits();
  const { data: requests = [] } = useModelChangeRequests(tenantId);
  const request = useRequestModelChange(tenantId);
  const [open, setOpen] = useState(false);
  const [wanted, setWanted] = useState("");
  const [reason, setReason] = useState("");

  const current = catalog.find((c) => c.model_id === model);
  const allowed = limits?.[plan]?.allowed_ai_vendors ?? ["gemini"];
  const vendors = Array.from(new Set(catalog.map((c) => c.vendor)));
  const pending = requests.find((r) => r.status === "pending");

  async function submit() {
    if (!wanted) return;
    try {
      await request.mutateAsync({ vendor: wanted, reason });
      toast.success("Solicitud enviada a soporte Walix");
      setOpen(false); setReason(""); setWanted("");
    } catch (e) {
      toast.error("No se pudo enviar la solicitud");
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
            <Cpu className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Motor de IA</p>
            <h3 className="text-lg font-bold">{current?.commercial_name ?? "Walix IA · Estándar"}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Proveedor: {aiVendorLabel(vendor)} · {current ? `${current.credit_factor}x créditos por acción` : "1x créditos por acción"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pending && <WBadge variant="warning">Solicitud en revisión</WBadge>}
          <Button variant="outline" onClick={() => setOpen(true)} disabled={!!pending}>
            Solicitar cambio
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Tu plan incluye acceso a: {allowed.map(aiVendorLabel).join(", ")}. El cambio de motor lo activa el equipo Walix
        tras revisar tu solicitud; los motores más potentes consumen más créditos de IA por acción.
      </p>

      {requests.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString("es-MX")} · {aiVendorLabel(r.requested_vendor)}
              </span>
              <WBadge variant={STATUS[r.status]?.variant ?? "brand"}>{STATUS[r.status]?.label ?? r.status}</WBadge>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar cambio de motor de IA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Motor deseado</label>
              <Select value={wanted} onValueChange={setWanted}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona un proveedor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v} value={v} disabled={!allowed.includes(v)}>
                      {aiVendorLabel(v)}{!allowed.includes(v) ? " (requiere plan superior)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">¿Por qué lo necesitas?</label>
              <Textarea className="mt-1" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. Necesitamos respuestas más precisas en propuestas técnicas." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={!wanted || request.isPending}>
              <Send className="h-4 w-4 mr-2" /> Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
