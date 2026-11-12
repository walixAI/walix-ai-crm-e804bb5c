import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateCronRequest } from "./cron-auth.ts";

export function matchesServiceCredential(auth: string | null, secret: string | undefined): boolean {
  return !!secret && auth === `Bearer ${secret}`;
}

// Legacy database callbacks keep their exact server credential; no decoded claims are trusted.
export function requireInternalRequest(req: Request, headers: Record<string, string>): Response | null {
  if (matchesServiceCredential(req.headers.get("authorization"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))) return null;
  const denied = authenticateCronRequest(req);
  return denied ? new Response(JSON.stringify({ error: "No autorizado" }), {
    status: denied.status, headers: { ...headers, "Content-Type": "application/json" },
  }) : null;
}

export async function requireUserRequest(req: Request, headers: Record<string, string>): Promise<Response | null> {
  const authorization = req.headers.get("authorization") ?? "";
  if (/^Bearer \S+$/.test(authorization)) {
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
    });
    const { data, error } = await client.auth.getUser();
    if (!error && data.user) return null;
  }
  return new Response(JSON.stringify({ error: "No autenticado" }), {
    status: 401, headers: { ...headers, "Content-Type": "application/json" },
  });
}

export function safeConversation(value: unknown, limit = 20): { role: "user" | "assistant"; content: string }[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw new Error("Conversación inválida");
  return value.slice(-limit).map((message) => {
    if (!message || !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" || message.content.length > 20000) throw new Error("Conversación inválida");
    return { role: message.role, content: message.content };
  });
}