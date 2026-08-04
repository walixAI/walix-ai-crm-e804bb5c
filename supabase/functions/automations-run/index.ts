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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();

    // 1. Procesar recurrencias genéricas (nuevo constructor de servicios recurrentes)
    const { data: recurrences } = await admin
      .from("recurrence_definitions")
      .select("*, tenants:tenant_id(organization_id)")
      .eq("is_active", true)
      .lte("next_run_at", now.toISOString());

    for (const rec of recurrences ?? []) {
      try {
        const tenantId = rec.tenant_id;
        const payload = rec.payload || {};

        // Crear ocurrencia
        const { data: occ } = await admin.from("recurrence_occurrences").insert({
          recurrence_id: rec.id,
          tenant_id: tenantId,
          scheduled_for: rec.next_run_at,
          status: "pending",
          metadata: payload,
        }).select("id").single();

        // Crear tarea asociada si aplica
        if (rec.action_type === "create_task" || payload.create_task) {
          const taskPayload = payload.task || payload;
          await admin.from("tasks").insert({
            tenant_id: tenantId,
            title: taskPayload.title || `Seguimiento: ${rec.name}`,
            description: taskPayload.description || rec.description,
            due_date: rec.next_run_at,
            assigned_to: rec.assigned_to,
            status: "pending",
            recurrence_occurrence_id: occ?.id,
            created_by: rec.created_by,
          });
        }

        // Crear actividad de recordatorio si aplica
        if (rec.action_type === "create_activity" || payload.create_activity) {
          const actPayload = payload.activity || payload;
          await admin.from("activities").insert({
            tenant_id: tenantId,
            type: "manual",
            notes: actPayload.notes || `Recordatorio programado: ${rec.name}`,
            owner_id: rec.assigned_to,
            created_by: rec.created_by,
          });
        }

        // Calcular siguiente ejecución
        const freq = rec.frequency;
        const interval = rec.interval || 1;
        const base = new Date(rec.next_run_at);
        let next = base;
        if (freq === "daily") next = addDays(base, interval);
        else if (freq === "weekly") next = addDays(base, 7 * interval);
        else if (freq === "biweekly") next = addDays(base, 14 * interval);
        else if (freq === "monthly") next = addMonths(base, interval);
        else if (freq === "quarterly") next = addMonths(base, 3 * interval);
        else if (freq === "semiannual") next = addMonths(base, 6 * interval);
        else if (freq === "yearly") next = addMonths(base, 12 * interval);
        else next = addMonths(base, interval);

        await admin.from("recurrence_definitions").update({
          last_run_at: now.toISOString(),
          next_run_at: next.toISOString(),
        }).eq("id", rec.id);

        // Registrar ejecución de automatización
        await admin.from("automation_runs").insert({
          automation_id: null,
          tenant_id: tenantId,
          trigger_snapshot: { recurrence_id: rec.id, type: "recurrence_due" },
          actions_executed: [{ type: rec.action_type, recurrence_occurrence_id: occ?.id }],
          status: "success",
        });
      } catch (e) {
        console.error("recurrence run error", rec.id, e);
      }
    }

    // 2. Procesar automatizaciones programadas clásicas
    const { data: automations } = await admin
      .from("automations")
      .select("*")
      .eq("is_active", true)
      .neq("trigger_type", "new_whatsapp_lead")
      .neq("trigger_type", "new_contact")
      .neq("trigger_type", "deal_stage_changed")
      .neq("trigger_type", "deal_won")
      .neq("trigger_type", "deal_lost");

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

    return new Response(JSON.stringify({ ok: true, processed_recurrences: recurrences?.length ?? 0, processed_automations: automations?.length ?? 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
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
