import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { analyzeCall } from "../_shared/call-analyzer.ts";

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Analiza una llamada a petición del asesor. El acceso se valida con la sesión (RLS de calls).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: "No autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const callId = typeof body?.callId === "string" ? body.callId : "";
    if (!/^[0-9a-f-]{36}$/i.test(callId)) return json({ error: "callId inválido" }, 400);
    const transcript = typeof body?.transcript === "string" ? body.transcript.slice(0, 20000) : undefined;

    const { data: visible } = await userClient.from("calls").select("id").eq("id", callId).maybeSingle();
    if (!visible) return json({ error: "Llamada no encontrada" }, 404);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const r = await analyzeCall(admin, callId, transcript);
    if (!r.ok) return json({ error: r.error }, r.status);
    return json(r);
  } catch (e) {
    console.error("call-analyzer error:", e);
    return json({ error: "Error interno" }, 500);
  }
});
