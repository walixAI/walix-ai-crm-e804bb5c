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

// Normaliza cualquier fecha al día 1 de su mes (la base sólo conoce el mes del servicio).
function monthStart(dateStr: string) {
  return `${dateStr.slice(0, 7)}-01`;
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

    // 1. Procesar recurrencias genéricas (constructor de servicios recurrentes).
    // La agenda futura (2 citas por suscripción) la mantiene recurrence_fill_horizon.
    // Aquí sólo se materializan oportunidad/tarea de las ocurrencias que entran
    // en la ventana de anticipación.
    const horizon = toDateStr(addDays(now, 60));
    const { data: pendingOccs } = await admin
      .from("recurrence_occurrences")
      .select("*, subscription:subscription_id(*), recurrence:recurrence_id(*)")
      .is("generated_deal_id", null)
      .eq("status", "pending")
      .lte("due_date", horizon)
      .order("due_date", { ascending: true });

    for (const occ of pendingOccs ?? []) {
      const rec = (occ as any).recurrence;
      const sub = (occ as any).subscription;
      if (!rec || !rec.enabled || !sub) continue;
      try {
        const tenantId = occ.tenant_id;
        const actions: any[] = rec.actions || [];
        const dueDate = monthStart(occ.due_date);
        const anticipation = Number(rec.anticipation_days ?? 5);
        // Sólo disparar dentro de la ventana de anticipación
        const trigger = toDateStr(addDays(new Date(dueDate + "T00:00:00"), -anticipation));
        if (today < trigger) continue;

        const { data: contact } = await admin
          .from("contacts")
          .select("id, owner_id")
          .eq("id", sub.contact_id)
          .maybeSingle();

        let generatedTaskId: string | null = null;
        let generatedDealId: string | null = null;

        // Etapa inicial del pipeline objetivo (el servicio aún no se ha acordado con el cliente)
        let initialStage: { id: string; name: string } | null = null;
        if (rec.target_pipeline_id) {
          const { data: stage } = await admin
            .from("pipeline_stages")
            .select("id, name")
            .eq("pipeline_id", rec.target_pipeline_id)
            .order("position", { ascending: true })
            .limit(1)
            .maybeSingle();
          initialStage = stage ?? null;
        }

        // Ejecutar acciones configuradas
        for (const action of actions) {
          try {
            if (action.type === "create_deal") {
              const { data: deal } = await admin.from("deals").insert({
                tenant_id: tenantId,
                contact_id: sub.contact_id,
                name: action.config?.title || rec.name,
                stage_id: initialStage?.id ?? rec.target_stage_id,
                stage_name: initialStage?.name ?? null,
                owner_id: contact?.owner_id,
                expected_close_date: dueDate,
                source: "Recurrencia",
                product_category_id: action.config?.product_category_id ?? null,
                service_frequency_months: rec.period_months ?? null,
              }).select("id").single();
              generatedDealId = deal?.id ?? null;
            } else if (action.type === "create_task") {
              // La tarea vence 5 días (anticipación) antes del inicio del mes del servicio
              const taskDue = toDateStr(addDays(new Date(dueDate + "T00:00:00"), -anticipation));
              const { data: task } = await admin.from("tasks").insert({
                tenant_id: tenantId,
                contact_id: sub.contact_id,
                deal_id: generatedDealId,
                title: action.config?.title || `${rec.name} — contactar y agendar`,
                due_at: `${taskDue}T09:00:00`,
                assignee_id: action.config?.assigned_to || contact?.owner_id || null,
                completed: false,
                task_kind: "seguimiento",
              }).select("id").single();
              generatedTaskId = task?.id ?? null;
            } else if (action.type === "notify_owner") {
              if (contact?.owner_id) {
                await admin.from("notifications").insert({
                  tenant_id: tenantId,
                  user_id: contact.owner_id,
                  title: rec.name,
                  message: action.config?.message || `Servicio programado para ${dueDate.slice(0, 7)}. Contacta al cliente para acordar precio y día.`,
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
        await admin.from("recurrence_occurrences").update({
          generated_task_id: generatedTaskId,
          generated_deal_id: generatedDealId,
          assigned_to: occ.assigned_to ?? contact?.owner_id ?? null,
        }).eq("id", occ.id);

        await admin.from("automation_runs").insert({
          tenant_id: tenantId,
          trigger_snapshot: { recurrence_id: rec.id, subscription_id: sub.id, type: "recurrence_due" },
          actions_executed: actions.map((a) => ({ type: a.type })),
          status: "success",
        });
      } catch (e) {
        console.error("recurrence occurrence error", (occ as any).id, e);
      }
    }

    // 1b. Mantener siempre el horizonte de citas futuras por suscripción
    try {
      const { data: allSubs } = await admin
        .from("recurrence_subscriptions")
        .select("id, recurrence:recurrence_id(future_horizon, enabled)");
      const { data: futureOccs } = await admin
        .from("recurrence_occurrences")
        .select("subscription_id, due_date, status")
        .gt("due_date", today)
        .neq("status", "skipped");
      const counts = new Map<string, number>();
      for (const o of futureOccs ?? []) {
        counts.set(o.subscription_id, (counts.get(o.subscription_id) ?? 0) + 1);
      }
      for (const s of allSubs ?? []) {
        const r = (s as any).recurrence;
        if (!r?.enabled) continue;
        const target = Number(r.future_horizon ?? 2);
        if ((counts.get(s.id) ?? 0) >= target) continue;
        await admin.rpc("recurrence_fill_horizon", { _subscription_id: s.id });
      }
    } catch (e) {
      console.error("recurrence horizon error", e);
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
