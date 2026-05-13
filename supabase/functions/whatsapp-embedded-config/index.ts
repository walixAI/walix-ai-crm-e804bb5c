const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const appId = Deno.env.get("META_APP_ID") ?? "";
  const configId = Deno.env.get("META_CONFIG_ID") ?? "";
  return new Response(JSON.stringify({ appId, configId, graphVersion: "v21.0" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});