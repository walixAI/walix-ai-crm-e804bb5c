import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RegisterPaymentInput {
  dealId: string;
  amount: number;
  method: "efectivo" | "transferencia" | "tarjeta" | "cheque" | "otro";
  reference?: string;
  paidAt?: string; // ISO
}

export function useRegisterDealPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterPaymentInput) => {
      const { data: deal, error: dErr } = await supabase
        .from("deals")
        .select("id, tenant_id, amount, amount_paid, contact_id, name")
        .eq("id", input.dealId)
        .maybeSingle();
      if (dErr) throw dErr;
      if (!deal) throw new Error("Oportunidad no encontrada");

      const total = Number(deal.amount ?? 0);
      const prevPaid = Number(deal.amount_paid ?? 0);
      const newPaid = prevPaid + input.amount;
      const fullyPaid = total > 0 && newPaid + 0.01 >= total;

      const patch: any = {
        amount_paid: newPaid,
        payment_status: fullyPaid ? "pagado" : "parcial",
      };
      if (fullyPaid) {
        patch.is_won = true;
        patch.is_lost = false;
        // Respeta la fecha de pago elegida (nunca futura); sin ella, hoy.
        const nowIso = new Date().toISOString();
        patch.won_at = input.paidAt && input.paidAt < nowIso ? input.paidAt : nowIso;
      }

      const { error: uErr } = await supabase
        .from("deals")
        .update(patch)
        .eq("id", input.dealId);
      if (uErr) throw uErr;

      // Log an activity on the contact so hay evidencia
      if (deal.contact_id) {
        const { data: auth } = await supabase.auth.getUser();
        await (supabase as any).from("activities").insert({
          tenant_id: deal.tenant_id,
          contact_id: deal.contact_id,
          deal_id: deal.id,
          agent_id: auth.user?.id ?? null,
          type: "note",
          description: `Pago registrado — $${input.amount.toLocaleString("es-MX")} (${input.method})${
            input.reference ? ` · Ref: ${input.reference}` : ""
          }${fullyPaid ? " — Oportunidad cerrada como Ganada." : " — Pago parcial."}`,
          occurred_at: input.paidAt ?? new Date().toISOString(),
          metadata: {
            payment: true,
            amount: input.amount,
            method: input.method,
            reference: input.reference ?? null,
            deal_id: deal.id,
            fully_paid: fullyPaid,
          },
        });
      }

      // Auto-close any open cobro tasks linked to this deal
      const { data: openTasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("deal_id", input.dealId)
        .eq("completed", false)
        .in("task_kind", ["cobro"]);
      if (openTasks?.length) {
        await supabase
          .from("tasks")
          .update({
            completed: true,
            closed_via: "manual",
            closed_note: `Pago registrado por $${input.amount.toLocaleString("es-MX")} (${input.method})`,
            closed_at: new Date().toISOString(),
          } as any)
          .in("id", openTasks.map((t: any) => t.id));
      }

      return { fullyPaid, newPaid };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mi-dia"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["contact-activity"] });
      qc.invalidateQueries({ queryKey: ["run-rate"] });
    },
  });
}

export function useRescheduleCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, newDate, reason }: { dealId: string; newDate: string; reason?: string }) => {
      const { data: deal } = await supabase
        .from("deals").select("tenant_id, contact_id, name").eq("id", dealId).maybeSingle();
      const { error } = await supabase
        .from("deals")
        .update({ expected_close_date: newDate })
        .eq("id", dealId);
      if (error) throw error;
      if (deal?.contact_id) {
        const { data: auth } = await supabase.auth.getUser();
        await (supabase as any).from("activities").insert({
          tenant_id: deal.tenant_id,
          contact_id: deal.contact_id,
          deal_id: dealId,
          agent_id: auth.user?.id ?? null,
          type: "note",
          description: `Cobro reagendado para ${new Date(newDate).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}${reason ? ` — ${reason}` : ""}`,
          occurred_at: new Date().toISOString(),
          metadata: { reschedule_collection: true, new_date: newDate, deal_id: dealId },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mi-dia"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["contact-activity"] });
    },
  });
}