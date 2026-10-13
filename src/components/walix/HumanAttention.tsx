import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { attentionLink, useHumanAttention, type HumanAttention } from "@/lib/queries/humanAttention";
import { useAuthStore } from "@/store/auth";

export function HumanAttentionBadge() {
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning"><UserRound className="h-3.5 w-3.5" />Requiere asesor</span>;
}

export function HumanAttentionPanel() {
  const { data: pending = [], isError } = useHumanAttention();
  const navigate = useNavigate();
  return <section className="space-y-2 border-b border-border pb-4" aria-label="Leads que requieren atención">
    <h2 className="font-semibold flex items-center gap-2 text-warning"><UserRound className="h-4 w-4" />Requieren atención del asesor · {pending.length}</h2>
    {isError ? <p className="text-sm text-destructive">No se pudieron cargar los pendientes.</p> : pending.length === 0 ? <p className="text-sm text-muted-foreground">Sin transferencias pendientes.</p> :
      <div className="grid gap-2 md:grid-cols-2">{pending.map(item => <div key={item.session_id} className="human-attention rounded-lg border border-warning/40 p-3 flex items-center gap-3">
        <div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{item.contact_name}</p><p className="text-xs text-muted-foreground">{item.reason} · {item.owner_name || "Sin asesor asignado"}</p></div>
        <Button size="sm" variant="outline" onClick={() => navigate(attentionLink(item))}>Atender<ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
      </div>)}</div>}
  </section>;
}

export function HumanAttentionModal() {
  const { data: pending } = useHumanAttention();
  const tenantId = useAuthStore(s => s.activeTenantId);
  const userId = useAuthStore(s => s.user?.id);
  const [current, setCurrent] = useState<HumanAttention | null>(null);
  const seen = useRef(new Set<string>());
  const navigate = useNavigate();
  useEffect(() => {
    try { seen.current = new Set(JSON.parse(sessionStorage.getItem(`attention-seen:${tenantId}:${userId}`) || "[]")); }
    catch { seen.current.clear(); }
    setCurrent(null);
  }, [tenantId, userId]);
  useEffect(() => {
    if (!pending || current) return;
    const next = pending.find(item => !seen.current.has(`${item.session_id}:${item.handoff_at}`));
    if (next) {
      setCurrent(next);
    }
  }, [pending, current]);
  useEffect(() => {
    if (current && pending && !pending.some(item => item.session_id === current.session_id && item.handoff_at === current.handoff_at)) setCurrent(null);
  }, [pending, current]);
  const dismiss = () => {
    if (current) seen.current.add(`${current.session_id}:${current.handoff_at}`);
    try { sessionStorage.setItem(`attention-seen:${tenantId}:${userId}`, JSON.stringify([...seen.current])); } catch { /* visual preference only */ }
    setCurrent(null);
  };
  return <Dialog open={!!current} onOpenChange={open => { if (!open) dismiss(); }}>
    <DialogContent><DialogHeader><DialogTitle>Un lead requiere atención del asesor</DialogTitle><DialogDescription>{current?.contact_name} fue transferido por {current?.agent_name}.</DialogDescription></DialogHeader>
      <p className="text-sm">{current?.reason}</p><p className="text-sm text-muted-foreground">Asesor: {current?.owner_name || "Por asignar"}</p>
      <Button onClick={() => { if (current) navigate(attentionLink(current)); dismiss(); }}>Abrir conversación<ArrowRight className="h-4 w-4 ml-2" /></Button>
    </DialogContent>
  </Dialog>;
}