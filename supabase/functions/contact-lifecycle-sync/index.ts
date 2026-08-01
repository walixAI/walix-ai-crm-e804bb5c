import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { data: tenants } = await supabase.from("tenants").select("id, contact_inactivity_days, customer_inactivity_months");
    if (!tenants) throw new Error("No se pudieron leer tenants");

    let total = 0;
    for (const t of tenants) {
      const inactivityDays = t.contact_inactivity_days ?? 90;
      const customerMonths = t.customer_inactivity_months ?? 6;
      const inactivityCutoff = new Date(Date.now() - inactivityDays * 86_400_000).toISOString();

      // Prospecto -> Inactivo
      const { data: prospectos } = await supabase
        .from("contacts")
        .select("id")
        .eq("tenant_id", t.id)
        .eq("status", "prospecto")
        .or(`last_activity.lt.${inactivityCutoff},last_activity.is.null`);

      if (prospectos && prospectos.length > 0) {
        const ids = prospectos.map((c) => c.id);
        const { error } = await supabase
          .from("contacts")
          .update({ status: "inactivo", updated_at: new Date().toISOString() })
          .in("id", ids);
        if (error) throw error;
        total += ids.length;
      }

      // Cliente -> Cliente ya inactivo (no won deals in last N months)
      const { data: staleClients, error: staleError } = await supabase.rpc("find_stale_clients", {
        p_tenant_id: t.id,
        p_months: customerMonths,
      });
      if (staleError) {
        // Fallback: inline query if RPC not available
        const monthsAgo = new Date();
        monthsAgo.setMonth(monthsAgo.getMonth() - customerMonths);
        const { data: inlineStale, error: inlineErr } = await supabase
          .from("contacts")
          .select("id")
          .eq("tenant_id", t.id)
          .eq("status", "cliente")
          .not("id", "in", (
            await supabase
              .from("deals")
              .select("contact_id")
              .eq("tenant_id", t.id)
              .eq("is_won", true)
              .gte("updated_at", monthsAgo.toISOString())
          ).data?.map((d) => d.contact_id) as string[] ?? []);
        if (inlineErr) throw inlineErr;
        if (inlineStale && inlineStale.length > 0) {
          const ids = inlineStale.map((c) => c.id);
          const { error } = await supabase
            .from("contacts")
            .update({ status: "cliente_inactivo", updated_at: new Date().toISOString() })
            .in("id", ids);
          if (error) throw error;
          total += ids.length;
        }
      } else if (staleClients && staleClients.length > 0) {
        const ids = staleClients.map((c: any) => c.id);
        const { error } = await supabase
          .from("contacts")
          .update({ status: "cliente_inactivo", updated_at: new Date().toISOString() })
          .in("id", ids);
        if (error) throw error;
        total += ids.length;
      }

      // Cliente ya inactivo -> Inactivo
      const { data: deadClients } = await supabase
        .from("contacts")
        .select("id")
        .eq("tenant_id", t.id)
        .eq("status", "cliente_inactivo")
        .or(`last_activity.lt.${inactivityCutoff},last_activity.is.null`);

      if (deadClients && deadClients.length > 0) {
        const ids = deadClients.map((c) => c.id);
        const { error } = await supabase
          .from("contacts")
          .update({ status: "inactivo", updated_at: new Date().toISOString() })
          .in("id", ids);
        if (error) throw error;
        total += ids.length;
      }
    }

    return new Response(JSON.stringify({ ok: true, updated: total }), {
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
