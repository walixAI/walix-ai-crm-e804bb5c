import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LABEL: Record<string, string> = {
  prospecto: "Prospecto",
  cliente: "Cliente",
  cliente_inactivo: "Cliente ya inactivo",
  inactivo: "Inactivo",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, contact_inactivity_days, customer_inactivity_months, lifecycle_grace_days");
    if (!tenants) throw new Error("No se pudieron leer tenants");

    const nowIso = new Date().toISOString();
    let proposed = 0;

    // Registra una propuesta de cambio + notificación al responsable.
    // Nunca cambia el status directamente: espera la aceptación del usuario.
    const propose = async (
      tenantId: string,
      contacts: any[],
      target: string,
      reason: string,
    ) => {
      for (const c of contacts) {
        if (c.status_proposed) continue; // ya hay una propuesta pendiente
        if (c.status_locked_until && c.status_locked_until > nowIso) continue; // en periodo de gracia

        const { error } = await supabase
          .from("contacts")
          .update({
            status_proposed: target,
            status_proposed_at: nowIso,
            status_proposed_reason: reason,
          })
          .eq("id", c.id);
        if (error) throw error;

        await supabase.from("notifications").insert({
          tenant_id: tenantId,
          user_id: c.owner_id,
          category: "operational",
          type: "lifecycle_change_request",
          title: "¿Cambiamos el ciclo de vida?",
          body: `${c.name ?? "Contacto"} pasaría de ${LABEL[c.status] ?? c.status} a ${LABEL[target] ?? target}. ${reason}`,
          link: `/contactos/${c.id}`,
          icon: "UserCog",
          severity: "warning",
          data: {
            contact_id: c.id,
            contact_name: c.name,
            from_status: c.status,
            to_status: target,
            reason,
          },
        });
        proposed++;
      }
    };

    for (const t of tenants) {
      const inactivityDays = t.contact_inactivity_days ?? 90;
      const customerMonths = t.customer_inactivity_months ?? 6;
      const inactivityCutoff = new Date(Date.now() - inactivityDays * 86_400_000).toISOString();
      const monthsAgo = new Date();
      monthsAgo.setMonth(monthsAgo.getMonth() - customerMonths);

      const cols = "id, name, status, owner_id, status_proposed, status_locked_until";

      // Prospecto -> Inactivo
      const { data: prospectos } = await supabase
        .from("contacts")
        .select(cols)
        .eq("tenant_id", t.id)
        .eq("status", "prospecto")
        .or(`last_activity_at.lt.${inactivityCutoff},last_activity_at.is.null`);
      await propose(
        t.id,
        prospectos ?? [],
        "inactivo",
        `Sin actividad en los últimos ${inactivityDays} días.`,
      );

      // Cliente -> Cliente ya inactivo (sin ventas ganadas recientes)
      const { data: recentWonContacts } = await supabase
        .from("deals")
        .select("contact_id")
        .eq("tenant_id", t.id)
        .eq("is_won", true)
        .gte("updated_at", monthsAgo.toISOString());
      const recentlyActiveIds = new Set((recentWonContacts ?? []).map((d) => d.contact_id));

      const { data: clients } = await supabase
        .from("contacts")
        .select(cols)
        .eq("tenant_id", t.id)
        .eq("status", "cliente");
      await propose(
        t.id,
        (clients ?? []).filter((c) => !recentlyActiveIds.has(c.id)),
        "cliente_inactivo",
        `Sin compras en los últimos ${customerMonths} meses.`,
      );

      // Cliente ya inactivo -> Inactivo
      const { data: deadClients } = await supabase
        .from("contacts")
        .select(cols)
        .eq("tenant_id", t.id)
        .eq("status", "cliente_inactivo")
        .or(`last_activity_at.lt.${inactivityCutoff},last_activity_at.is.null`);
      await propose(
        t.id,
        deadClients ?? [],
        "inactivo",
        `Sin actividad en los últimos ${inactivityDays} días.`,
      );
    }

    return new Response(JSON.stringify({ ok: true, proposed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
