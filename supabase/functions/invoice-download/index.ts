import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "No autorizado" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Sesión inválida" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const invoiceId = typeof body.invoice_id === "string" ? body.invoice_id : "";
    const kind = body.kind === "xml" ? "xml" : "pdf";
    if (!invoiceId) return json({ error: "invoice_id requerido" }, 400);

    const { data: invoice } = await admin
      .from("tenant_invoices")
      .select("id, tenant_id, pdf_path, xml_path, period")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!invoice) return json({ error: "Factura no encontrada" }, 404);

    // El usuario debe pertenecer al tenant de la factura
    const { data: allowed } = await admin.rpc("user_can_use_tenant", {
      _user_id: userId,
      _tenant_id: invoice.tenant_id,
    });
    if (!allowed) return json({ error: "Sin acceso a esta factura" }, 403);

    const path = kind === "xml" ? invoice.xml_path : invoice.pdf_path;
    if (!path) return json({ error: "Archivo no disponible" }, 404);

    const period = String(invoice.period).slice(0, 7);
    const { data: signed, error: signErr } = await admin.storage
      .from("invoices")
      .createSignedUrl(path, 120, { download: `CFDI-${period}.${kind}` });
    if (signErr || !signed) return json({ error: "No se pudo generar el enlace" }, 500);

    return json({ url: signed.signedUrl });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
