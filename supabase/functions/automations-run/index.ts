// Edge function: motor de automatizaciones programadas.
// Se invoca vía cron cada hora y ejecuta triggers de tipo scheduled y recurrencias.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const cors = { ...corsHeaders };

function addMonths(d: Date, months: number) {
  const nd = new Date(d);
  nd.setMonth(nd.getMonth() + months);
  return nd;
}

function addDays(d: Date, days: number) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const today = toDateStr(now);

    // 1. Procesar recurrencias genéricas (constructor de servicios recurrentes)
    const { data: subs } = await admin
      .from("recurrence_subscriptions")
      .select("*, recurrence:recurrence_id(*)")
      .lte("next_due_date", today)
      .order("next_due_date", { ascending: true });

    for (const sub of subs ?? []) {
      const rec = sub.recurrence as any;
      if (!rec || !rec.enabled) continue;
      try {
        const tenantId = sub.tenant_id;
        const actions: any[] = rec.actions || [];

        // Crear ocurrencia
        const { data: occ } = await admin.from("recurrence_occurrences").insert({
          recurrence_id: rec.id,
          subscription_id: sub.id,
          tenant_id: tenantId,
          due_date: sub.next_due_date,
          status: "pending",
        }).select("id").single();

        let generatedTaskId: string | null = null;
        let generatedDealId: string | null = null;

        // Ejecutar acciones configuradas
        for (const action of actions) {
          try {
            if (action.type === "create_task") {
              const { data: task } = await admin.from("tasks").insert({
                tenant_id: tenantId,
                contact_id: sub.contact_id,
                title: action.config?.title || `Seguimiento: ${rec.name}`,
                description: action.config?.description || rec.description || "",
                due_date: sub.next_due_date,
                assigned_to: action.config?.assigned_to || null,
                status: "pending",
                recurrence_occurrence_id: occ?.id,
                created_by: rec.created_by,
              }).select("id").single();
              generatedTaskId = task?.id ?? null;
            } else if (action.type === "create_deal") {
              const { data: contact } = await admin.from("contacts").select("id, owner_id").eq("id", sub.contact_id).maybeSingle();
              const { data: deal } = await admin.from("deals").insert({
                tenant_id: tenantId,
                contact_id: sub.contact_id,
                name: action.config?.title || `${rec.name} - ${sub.next_due_date}`,
                stage_id: rec.target_stage_id,
                owner_id: contact?.owner_id,
                expected_close_date: sub.next_due_date,
                source: "Recurrencia",
              }).select("id").single();
              generatedDealId = deal?.id ?? null;
            } else if (action.type === "notify_owner") {
              const { data: contact } = await admin.from("contacts").select("owner_id").eq("id", sub.contact_id).maybeSingle();
              if (contact?.owner_id) {
                await admin.from("notifications").insert({
                  tenant_id: tenantId,
                  user_id: contact.owner_id,
                  title: rec.name,
                  message: action.config?.message || `Vence el servicio recurrente el ${sub.next_due_date}`,
                  category: "operational",
                  severity: "info",
                });
              }
            }
          } catch (e) {
            console.error("recurrence action error", rec.id, action.type, e);
          }
        }

        // Actualizar ocurrencia con referencias generadas
        if (occ) {
          await admin.from("recurrence_occurrences").update({
            generated_task_id: generatedTaskId,
            generated_deal_id: generatedDealId,
          }).eq("id", occ.id);
        }

        // Calcular siguiente fecha de vencimiento
        const period = rec.period_months ?? (rec.kind === "calendar" ? 12 : 1);
        const nextDue = addMonths(new Date(sub.next_due_date + "T00:00:00"), period);
        await admin.from("recurrence_subscriptions").update({
          last_executed_date: sub.next_due_date,
          next_due_date: toDateStr(nextDue),
        }).eq("id", sub.id);

        await admin.from("automation_runs").insert({
          tenant_id: tenantId,
          trigger_snapshot: { recurrence_id: rec.id, subscription_id: sub.id, type: "recurrence_due" },
          actions_executed: actions.map((a) => ({ type: a.type })),
          status: "success",
        });
      } catch (e) {
        console.error("recurrence subscription error", sub.id, e);
      }
    }

    // 2. Procesar automatizaciones programadas clásicas
    const { data: automations } = await admin
      .from("automations")
      .select("*")
      .eq("is_active", true)
      .in("trigger_type", ["deal_inactive", "deal_close_date_near", "contact_no_reply"]);

    for (const auto of automations ?? []) {
      try {
        const cfg = auto.trigger_config || {};
        if (auto.trigger_type === "deal_inactive") {
          const days = Number(cfg.days || 5);
          const since = addDays(now, -days).toISOString();
          const { data: deals } = await admin
            .from("deals")
            .select("id, tenant_id, owner_id")
            .eq("tenant_id", auto.tenant_id)
            .or(`updated_at.lt.${since},last_activity_at.lt.${since}`)
            .not("status", "in", "(won,lost)");
          for (const d of deals ?? []) {
            await executeActions(admin, auto, d);
          }
        } else if (auto.trigger_type === "deal_close_date_near") {
          const days = Number(cfg.days || 3);
          const target = addDays(now, days).toISOString().slice(0, 10);
          const { data: deals } = await admin
            .from("deals")
            .select("id, tenant_id, owner_id")
            .eq("tenant_id", auto.tenant_id)
            .eq("expected_close_date", target)
            .not("status", "in", "(won,lost)");
          for (const d of deals ?? []) {
            await executeActions(admin, auto, d);
          }
        } else if (auto.trigger_type === "contact_no_reply") {
          const days = Number(cfg.days || 3);
          const since = addDays(now, -days).toISOString();
          const { data: contacts } = await admin
            .from("contacts")
            .select("id, tenant_id, owner_id")
            .eq("tenant_id", auto.tenant_id)
            .lt("last_inbound_at", since)
            .or("lifecycle.eq.prospecto,lifecycle.eq.cliente");
          for (const c of contacts ?? []) {
            await executeActions(admin, auto, c);
          }
        }
      } catch (e) {
        console.error("automation run error", auto.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed_subscriptions: subs?.length ?? 0, processed_automations: automations?.length ?? 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("automations-run error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Error interno" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

async function executeActions(admin: any, automation: any, entity: any) {
  const actions = automation.actions || [];
  const executed: any[] = [];
  for (const action of actions) {
    try {
      if (action.type === "create_task") {
        await admin.from("tasks").insert({
          tenant_id: entity.tenant_id,
          title: action.config?.title || "Tarea automática",
          description: action.config?.description || "",
          assigned_to: entity.owner_id,
          status: "pending",
          deal_id: entity.id,
          created_by: automation.created_by,
        });
      } else if (action.type === "notify_owner") {
        await admin.from("notifications").insert({
          tenant_id: entity.tenant_id,
          user_id: entity.owner_id,
          title: automation.name,
          message: action.config?.message || "",
          category: "operational",
          severity: "info",
        });
      }
      executed.push(action);
    } catch (e) {
      console.error("action error", action.type, e);
    }
  }
  await admin.from("automation_runs").insert({
    automation_id: automation.id,
    tenant_id: entity.tenant_id,
    trigger_snapshot: { entity_id: entity.id, trigger_type: automation.trigger_type },
    actions_executed: executed,
    status: executed.length > 0 ? "success" : "partial",
  });
}
