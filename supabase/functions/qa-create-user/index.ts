// Retired production QA helper. Never create users, reset passwords or assign roles here.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "content-type": "application/json",
};

export function handleRetiredQaRequest(req: Request): Response {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  return new Response(JSON.stringify({ error: "Esta función de pruebas está deshabilitada" }), {
    status: 410, headers,
  });
}

if (import.meta.main) Deno.serve(handleRetiredQaRequest);