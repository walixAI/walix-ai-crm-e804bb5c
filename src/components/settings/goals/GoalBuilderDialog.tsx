import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useTenantId } from "@/lib/queries/tenant";
import { useMembers } from "@/lib/queries/team";
import { usePipelines } from "@/lib/queries/pipeline";
import {
  useProductCategories, useSaveMonthlyGoal, useGoalAssignments,
  suggestGoalSplit, type GoalDimension, type GoalMetric, type MonthlyGoal,
} from "@/lib/queries/monthlyGoals";

import { useDealTypeOptions } from "@/lib/queries/dealTypes";


function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

function formatCount(n: number) {
  const v = Math.round(n * 10) / 10;
  return `${v.toLocaleString("es-MX")} ${v === 1 ? "venta" : "ventas"}`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  year: number;
  month: number;
  goal?: MonthlyGoal | null;
}

export function GoalBuilderDialog({ open, onOpenChange, year, month, goal }: Props) {
  const { data: tenantId } = useTenantId();
  const { data: members = [] } = useMembers(tenantId);
  const { data: pipelines = [] } = usePipelines();
  const { data: categories = [] } = useProductCategories();
  const { data: existingAssignments = [] } = useGoalAssignments(goal?.id);
  const save = useSaveMonthlyGoal();

  const [dimension, setDimension] = useState<GoalDimension>("global");
  const [dimValueText, setDimValueText] = useState<string>("");
  const [dimValueUuid, setDimValueUuid] = useState<string>("");
  const [metric, setMetric] = useState<GoalMetric>("amount");
  const [amount, setAmount] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");
  const [isDraft, setIsDraft] = useState<boolean>(false);
  const [shares, setShares] = useState<Record<string, number>>({}); // userId -> percent
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allEqual, setAllEqual] = useState(false);

  // Preload when opening
  useEffect(() => {
    if (!open) return;
    if (goal) {
      setDimension(goal.dimension);
      setDimValueText(goal.dimension_value_text ?? "");
      setDimValueUuid(goal.dimension_value_uuid ?? "");
      setMetric(goal.metric ?? "amount");
      setAmount(String(goal.amount));
      setNotes(goal.notes ?? "");
      setIsDraft(goal.is_draft);
    } else {
      setDimension("global");
      setDimValueText("");
      setDimValueUuid("");
      setMetric("amount");
      setAmount("0");
      setNotes("");
      setIsDraft(false);
      setShares({});
      setSelected(new Set());
      setAllEqual(false);
    }
  }, [open, goal?.id]);

  useEffect(() => {
    if (!open || !goal) return;
    const s: Record<string, number> = {};
    const sel = new Set<string>();
    existingAssignments.forEach((a) => {
      s[a.user_id] = Number(a.share_percent);
      sel.add(a.user_id);
    });
    setShares(s);
    setSelected(sel);
  }, [open, goal?.id, existingAssignments.length]);

  const activeMembers = useMemo(() => members.filter((m: any) => m.is_active), [members]);

  function splitEqually(uids: string[]) {
    const s: Record<string, number> = {};
    if (uids.length === 0) return s;
    const each = Math.round((100 / uids.length) * 100) / 100;
    uids.forEach((u, i) => (s[u] = i === uids.length - 1
      ? Math.round((100 - each * (uids.length - 1)) * 100) / 100
      : each));
    return s;
  }

  // "Aplica a todos por partes iguales": mantiene seleccionados a todos los miembros activos
  useEffect(() => {
    if (!allEqual) return;
    const uids = activeMembers.map((m: any) => m.id);
    setSelected(new Set(uids));
    setShares(splitEqually(uids));
  }, [allEqual, activeMembers.length]);

  const totalPct = useMemo(
    () => Array.from(selected).reduce((sum, uid) => sum + (shares[uid] ?? 0), 0),
    [selected, shares]
  );
  const amountNum = Number(amount) || 0;
  const formatTarget = (n: number) => (metric === "count" ? formatCount(n) : formatMXN(n));
  const validPct = Math.abs(totalPct - 100) < 0.01 || selected.size === 0;

  function toggleMember(uid: string) {
    if (allEqual) return;
    const next = new Set(selected);
    if (next.has(uid)) {
      next.delete(uid);
      const s = { ...shares };
      delete s[uid];
      setShares(s);
    } else {
      next.add(uid);
    }
    setSelected(next);
  }

  function distributeEqually() {
    const uids = Array.from(selected);
    if (uids.length === 0) return;
    setShares(splitEqually(uids));
  }

  async function suggestByHistory() {
    if (!tenantId || selected.size === 0 || allEqual) return;
    try {
      const res = await suggestGoalSplit({
        tenantId,
        dimension,
        dimensionValueText: dimension === "deal_type" ? dimValueText || null : null,
        dimensionValueUuid: dimension === "pipeline" || dimension === "product_category" ? dimValueUuid || null : null,
        userIds: Array.from(selected),
      });
      const s: Record<string, number> = {};
      res.forEach((r) => (s[r.user_id] = Number(r.share_percent)));
      // Round to make sum 100
      const sum = Object.values(s).reduce((a, b) => a + b, 0);
      if (sum > 0) {
        const factor = 100 / sum;
        Object.keys(s).forEach((k) => (s[k] = Math.round(s[k] * factor * 100) / 100));
      }
      setShares(s);
      toast.success("Reparto sugerido según historial (últimos 3 meses)");
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo calcular la sugerencia");
    }
  }

  const dimValueMissing =
    (dimension === "deal_type" && !dimValueText) ||
    ((dimension === "pipeline" || dimension === "product_category") && !dimValueUuid);

  async function onSave() {
    if (amountNum <= 0) {
      toast.error(metric === "count" ? "Captura una cantidad mayor a 0" : "Captura un monto mayor a 0");
      return;
    }
    if (dimValueMissing) {
      toast.error("Elige el valor de la dimensión");
      return;
    }
    if (!validPct && !isDraft) {
      toast.error(`La suma de porcentajes debe ser 100% (actual: ${totalPct.toFixed(2)}%). Puedes marcarla como borrador.`);
      return;
    }
    try {
      await save.mutateAsync({
        id: goal?.id,
        year, month,
        amount: amountNum,
        metric,
        dimension,
        dimensionValueText: dimension === "deal_type" ? dimValueText : null,
        dimensionValueUuid: dimension === "pipeline" || dimension === "product_category" ? dimValueUuid : null,
        notes: notes.trim() || null,
        isDraft,
        assignments: Array.from(selected).map((uid) => ({ user_id: uid, share_percent: shares[uid] ?? 0 })),
      });
      toast.success(goal ? "Meta actualizada" : "Meta creada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nueva meta mensual"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Dimensión</Label>
              <Select value={dimension} onValueChange={(v) => { setDimension(v as GoalDimension); setDimValueText(""); setDimValueUuid(""); }} disabled={!!goal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Meta global</SelectItem>
                  <SelectItem value="deal_type">Por tipo de deal</SelectItem>
                  <SelectItem value="pipeline">Por pipeline</SelectItem>
                  <SelectItem value="product_category">Por categoría/producto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dimension === "deal_type" && (
              <div>
                <Label>Tipo de deal</Label>
                <Select value={dimValueText} onValueChange={setDimValueText}>
                  <SelectTrigger><SelectValue placeholder="Elige un tipo" /></SelectTrigger>
                  <SelectContent>
                    {DEAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {dimension === "pipeline" && (
              <div>
                <Label>Pipeline</Label>
                <Select value={dimValueUuid} onValueChange={setDimValueUuid}>
                  <SelectTrigger><SelectValue placeholder="Elige un pipeline" /></SelectTrigger>
                  <SelectContent>
                    {pipelines.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {dimension === "product_category" && (
              <div>
                <Label>Categoría/producto</Label>
                <Select value={dimValueUuid} onValueChange={setDimValueUuid}>
                  <SelectTrigger><SelectValue placeholder="Elige categoría" /></SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Aún no tienes categorías. Créalas primero.
                      </div>
                    )}
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Tipo de meta</Label>
              <Select value={metric} onValueChange={(v) => setMetric(v as GoalMetric)} disabled={!!goal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Monto (MXN)</SelectItem>
                  <SelectItem value="count">Cantidad de ventas (oportunidades ganadas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{metric === "count" ? "Cantidad de ventas a cerrar" : "Monto de la meta (MXN)"}</Label>
              <Input
                type="number"
                value={amount}
                step={metric === "count" ? 1 : 100}
                min={0}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" /> Reparto entre agentes
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={distributeEqually} disabled={selected.size === 0 || allEqual}>
                  Partes iguales
                </Button>
                <Button size="sm" variant="outline" onClick={suggestByHistory} disabled={selected.size === 0 || allEqual}>
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Sugerir por historial
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-2.5">
              <Switch checked={allEqual} onCheckedChange={setAllEqual} />
              <div className="text-sm leading-tight">
                <Label className="cursor-pointer">Aplica a todos por partes iguales</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reparte la meta entre los {activeMembers.length} usuarios activos del equipo
                  {activeMembers.length > 0 && ` (${(100 / activeMembers.length).toFixed(2)}% · ${formatTarget(Math.round((amountNum / activeMembers.length) * 100) / 100)} c/u)`}.
                </p>
              </div>
            </div>

            {activeMembers.length === 0 && (
              <div className="text-sm text-muted-foreground">Sin miembros activos en el equipo.</div>
            )}

            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {activeMembers.map((m: any) => {
                const isSel = selected.has(m.id);
                const pct = shares[m.id] ?? 0;
                const userAmt = Math.round(amountNum * pct) / 100;
                return (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40">
                    <Checkbox checked={isSel} disabled={allEqual} onCheckedChange={() => toggleMember(m.id)} />
                    <Avatar className="h-8 w-8">
                      {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                      <AvatarFallback>{(m.full_name ?? m.email ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.full_name ?? m.email}</div>
                      <div className="text-xs text-muted-foreground truncate">{isSel ? formatTarget(userAmt) : "—"}</div>
                    </div>
                    <Input
                      type="number"
                      className="w-24 h-8 text-right"
                      value={isSel ? pct : ""}
                      placeholder="%"
                      disabled={!isSel || allEqual}
                      onChange={(e) => setShares({ ...shares, [m.id]: Number(e.target.value) || 0 })}
                      step={0.01}
                      min={0}
                      max={100}
                    />
                    <span className="text-xs text-muted-foreground w-4">%</span>
                  </div>
                );
              })}
            </div>

            {selected.size > 0 && (
              <div className={`flex items-center justify-between text-sm px-1 pt-2 border-t ${validPct ? "text-emerald-600" : "text-amber-600"}`}>
                <span>Total asignado</span>
                <span className="font-semibold">
                  {totalPct.toFixed(2)}% {!validPct && <AlertTriangle className="inline h-3.5 w-3.5 ml-1" />}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Nota (opcional)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isDraft} onCheckedChange={setIsDraft} />
            <Label className="cursor-pointer text-sm">Guardar como borrador (permite %  ≠ 100)</Label>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={save.isPending}>Guardar meta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}