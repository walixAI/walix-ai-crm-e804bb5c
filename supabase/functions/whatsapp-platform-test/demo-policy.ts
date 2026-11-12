// Deployment-controlled: never accept an enable flag from a request.
export const PLATFORM_DEMOS_ENABLED = false;

export function disabledDemoResponse(headers: Record<string, string>): Response | null {
  if (PLATFORM_DEMOS_ENABLED) return null;
  return new Response(JSON.stringify({ error: "Las pruebas de WhatsApp para demos están apagadas." }), {
    status: 403, headers: { ...headers, "Content-Type": "application/json" },
  });
}