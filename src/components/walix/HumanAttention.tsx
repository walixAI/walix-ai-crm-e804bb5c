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

export function HumanAttentionBanner() {
  const { data: pending = [], isError } = useHumanAttention();
  const navigate = useNavigate();
  if (!pending.length && !isError) return null;
  return <section className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-warning/30 bg-warning/10 px-3 py-2 md:px-6" aria-label="Leads que requieren atención">
    <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-warning" role="status">
      <UserRound className="h-4 w-4 shrink-0" />
      {isError ? "No se pudieron actualizar los pendientes" : `${pending.length} ${pending.length === 1 ? "lead requiere" : "leads requieren"} atención del asesor`}
    </div>
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
      {pending.map(item => <Button key={item.session_id} size="sm" variant="ghost"
        className="h-8 shrink-0 gap-2 text-foreground hover:bg-warning/15"
        title={`${item.reason || "Requiere asesor"} · ${item.owner_name || "Sin asesor asignado"}`}
        onClick={() => navigate(attentionLink(item))}>
        <span className="max-w-40 truncate">{item.contact_name}</span><ArrowRight className="h-3.5 w-3.5 shrink-0" />
      </Button>)}
    </div>
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