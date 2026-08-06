// Crea la cuenta de un usuario invitado (email ya verificado por el enlace) y acepta la invitación.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { token, password, full_name } = await req.json();
    if (!token || !password || String(password).length < 8) {
      return json({ error: "Datos incompletos: token y contraseña (mínimo 8 caracteres)." }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: inv, error: invErr } = await admin
      .from("invitations")
      .select("id, email, role, tenant_id, accepted_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (invErr) throw invErr;
    if (!inv) return json({ error: "La invitación no existe." }, 404);
    if (inv.accepted_at) return json({ error: "Esta invitación ya fue aceptada." }, 409);
    if (new Date(inv.expires_at) < new Date()) return json({ error: "Esta invitación expiró." }, 410);

    const email = String(inv.email).toLowerCase();

    // Crear usuario (o reutilizar si ya existía)
    let userId: string | null = null;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || email, invitation_token: token },
    });
    if (cErr) {
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users?.find((u: any) => (u.email ?? "").toLowerCase() === email);
      if (!found) throw cErr;
      userId = found.id;
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      userId = created.user!.id;
    }

    // Asegurar perfil + rol en el tenant y marcar invitación aceptada
    await admin.from("profiles").upsert(
      {
        id: userId!,
        email,
        full_name: full_name || email,
        tenant_id: inv.tenant_id,
        active_tenant_id: inv.tenant_id,
        onboarded: true,
        is_active: true,
      },
      { onConflict: "id" },
    );

    await admin.from("user_roles").upsert(
      { user_id: userId!, role: inv.role, tenant_id: inv.tenant_id },
      { onConflict: "user_id,role,tenant_id" as any, ignoreDuplicates: true } as any,
    );

    await admin
      .from("invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: userId })
      .eq("id", inv.id);

    return json({ ok: true, email, tenant_id: inv.tenant_id });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});