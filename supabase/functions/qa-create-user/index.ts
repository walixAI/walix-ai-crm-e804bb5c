// One-shot admin helper to create a QA user and attach to a tenant.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { email, password, full_name, tenant_id, role = "tenant_admin", mode = "simple" } = await req.json();
    if (!email || !password || !tenant_id) {
      return new Response(JSON.stringify({ error: "email, password, tenant_id required" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Create or reuse the auth user
    let userId: string | null = null;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name ?? email, company_name: "Refrigeración G&R" },
    });
    if (cErr) {
      // If already exists, look them up
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users?.find((u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase());
      if (!found) throw cErr;
      userId = found.id;
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      userId = created.user!.id;
    }

    // Ensure profile points at tenant + mode
    await admin.from("profiles").upsert({
      id: userId!,
      email,
      full_name: full_name ?? email,
      tenant_id,
      active_tenant_id: tenant_id,
      onboarded: true,
      is_active: true,
      ui_prefs: { mode },
    }, { onConflict: "id" });

    // Ensure role on this tenant
    await admin.from("user_roles").upsert(
      { user_id: userId!, role, tenant_id },
      { onConflict: "user_id,role,tenant_id" as any, ignoreDuplicates: true } as any,
    );

    return new Response(JSON.stringify({ ok: true, user_id: userId, email, tenant_id }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});