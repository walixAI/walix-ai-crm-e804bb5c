import { useState } from "react";
import { CreditCard, Lock, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWaTemplates } from "@/lib/queries/whatsappCampaigns";
import { useGrantExtraAttempt, useRequestExtraAttempt, useTemplatePolicy } from "@/lib/queries/waSpend";

interface Props {
  tenantId: string | null;
  contactId: string | null;
  contactName: string;
  signal?: unknown;
  sending?: boolean;
  onSendTemplate: (t: { name: string; language: string; params: string[]; preview: string }) => Promise<void> | void;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-MX", { weekday: "long", hour: "2-digit", minute: "2-digit" });
}

export function PaidTemplateBar({ tenantId, contactId, contactName, signal, sending, onSendTemplate }: Props) {
  const { data: policy, isLoading } = useTemplatePolicy(tenantId, contactId, signal);
  const { data: templates = [] } = useWaTemplates();
  const grant = useGrantExtraAttempt();
  const request = useRequestExtraAttempt();
  const [tplId, setTplId] = useState<string>("");
  const approved = templates.filter((t: any) => String(t.status).toUpperCase() === "APPROVED");
  const tpl = approved.find((t: any) => t.id === tplId) as any;
  const first = (contactName || "").split(" ")[0] ?? "";

  if (isLoading || !policy) return <div className="flex-1 text-xs text-muted-foreground px-2">Revisando límites…</div>;

  const blocked = !policy.allowed;
  const vars: string[] = Array.isArray(tpl?.variables) ? tpl.variables : [];
  const params = vars.map((v: string) => (/nombre/i.test(v) ? first : ""));
  const preview = tpl ? String(tpl.body_text ?? `Plantilla ${tpl.name}`).replace(/\{\{\s*(\w+)\s*\}\}/g, (_m: string, k: string) => (/nombre|1/.test(k) ? first : "")) : "";

  return (
    <div className="flex-1 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium">
        {blocked ? <Lock className="h-3.5 w-3.5 text-destructive" /> : <CreditCard className="h-3.5 w-3.5 text-warning" />}
        {blocked ? (
          <span className="text-destructive">
            {policy.message}
            {policy.reason === "lead_gap" && policy.next_at ? ` Próximo intento: ${fmtDate(policy.next_at)}.` : ""}
          </span>
        ) : (
          <span className="text-warning">
            Intento {policy.attempt} de {policy.max} · se cobrará
            {policy.bypass ? " · autorizado por ser gerente" : ""}
          </span>
        )}
      </div>

      {blocked ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm" variant="outline" disabled={request.isPending || !contactId}
            onClick={() => request.mutate(contactId!, {
              onSuccess: (n) => toast.success(n ? "Se pidió autorización a tu gerente" : "No hay gerentes a quién avisar"),
              onError: (e: any) => toast.error(e?.message ?? "No se pudo pedir autorización"),
            })}
          >
            Pedir autorización
          </Button>
          {policy.is_manager && (
            <Button size="sm" variant="secondary" disabled={grant.isPending}
              onClick={() => grant.mutate(contactId!, { onSuccess: () => toast.success("Se autorizó un intento más") })}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Autorizar un intento más
            </Button>
          )}
        </div>
      ) : approved.length === 0 ? (
        <p className="text-xs text-muted-foreground">No hay plantillas aprobadas por Meta todavía. Créalas en Configuración → WhatsApp.</p>
      ) : (
        <div className="flex items-center gap-2">
          <Select value={tplId} onValueChange={setTplId}>
            <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Elegir plantilla aprobada" /></SelectTrigger>
            <SelectContent>
              {approved.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="icon" className="h-9 w-9 shrink-0" disabled={!tpl || sending} title="Enviar plantilla"
            onClick={async () => { await onSendTemplate({ name: tpl.name, language: tpl.language ?? "es_MX", params, preview }); setTplId(""); }}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
      {tpl && !blocked && <p className="text-[11px] text-muted-foreground line-clamp-2">{preview}</p>}
    </div>
  );
}
