// Registro automático del consumo de IA por función.
// Importar al inicio de una Edge Function: `installAiUsageTracking("nombre_funcion")`.
// Intercepta las llamadas al gateway de IA, lee los tokens de la respuesta (JSON o stream)
// y los guarda en ai_usage_log con `surface = nombre_funcion`, sin descontar créditos.
// La empresa se toma de setAiUsageContext() o, si no, del usuario que hizo la petición.
import { AsyncLocalStorage } from "node:async_hooks";
import { createClient } from "npm:@supabase/supabase-js@2";
import { recordAiUsage } from "./ai-usage.ts";

type Ctx = { tenantId?: string | null; userId?: string | null; auth?: string | null };
const als = new AsyncLocalStorage<Ctx>();
let installed = false;

export function setAiUsageContext(c: { tenantId?: string | null; userId?: string | null }) {
  const store = als.getStore();
  if (!store) return;
  if (c.tenantId) store.tenantId = c.tenantId;
  if (c.userId) store.userId = c.userId;
}

async function resolveTenant(ctx: Ctx): Promise<{ tenantId: string | null; userId: string | null }> {
  if (ctx.tenantId) return { tenantId: ctx.tenantId, userId: ctx.userId ?? null };
  const token = ctx.auth?.replace(/^Bearer\s+/i, "");
  if (!token) return { tenantId: null, userId: null };
  try {
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const { data } = await svc.auth.getUser(token);
    const uid = data?.user?.id;
    if (!uid) return { tenantId: null, userId: null };
    const { data: p } = await svc.from("profiles").select("active_tenant_id, tenant_id").eq("id", uid).maybeSingle();
    return { tenantId: (p?.active_tenant_id ?? p?.tenant_id) ?? null, userId: uid };
  } catch {
    return { tenantId: null, userId: null };
  }
}

function usageFromText(text: string): { model?: string; usage?: any } {
  try {
    const j = JSON.parse(text);
    return { model: j?.model, usage: j?.usage };
  } catch { /* stream */ }
  let model: string | undefined; let usage: any;
  for (const line of text.split("\n")) {
    const l = line.trim();
    if (!l.startsWith("data:")) continue;
    const payload = l.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const j = JSON.parse(payload);
      model ??= j?.model ?? j?.response?.model;
      const u = j?.usage ?? j?.response?.usage;
      if (u) usage = u;
    } catch { /* noop */ }
  }
  return { model, usage };
}

export function installAiUsageTracking(feature: string) {
  if (installed) return;
  installed = true;

  const origServe = Deno.serve.bind(Deno);
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (...args: any[]) => {
    const idx = typeof args[0] === "function" ? 0 : typeof args[1] === "function" ? 1 : -1;
    if (idx >= 0) {
      const h = args[idx];
      args[idx] = (req: Request, info: unknown) =>
        als.run({ auth: req.headers.get("Authorization") }, () => h(req, info));
    } else if (args[0]?.handler) {
      const h = args[0].handler;
      args[0] = { ...args[0], handler: (req: Request, info: unknown) =>
        als.run({ auth: req.headers.get("Authorization") }, () => h(req, info)) };
    }
    // deno-lint-ignore no-explicit-any
    return (origServe as any)(...args);
  };

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await origFetch(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("ai.gateway.lovable.dev") || !res.ok) return res;
    const ctx = als.getStore() ?? {};
    let reqModel: string | undefined;
    try { reqModel = JSON.parse(String(init?.body ?? "{}"))?.model; } catch { /* noop */ }
    const clone = res.clone();
    const job = (async () => {
      try {
        const { model, usage } = usageFromText(await clone.text());
        const { tenantId, userId } = await resolveTenant(ctx);
        if (!tenantId) return;
        await recordAiUsage({
          tenantId, userId, surface: feature, model: reqModel || model || "desconocido",
          inputTokens: Number(usage?.prompt_tokens ?? usage?.input_tokens ?? 0),
          outputTokens: Number(usage?.completion_tokens ?? usage?.output_tokens ?? 0),
          totalTokens: Number(usage?.total_tokens ?? 0),
          charge: false,
        });
      } catch (e) {
        console.error("[ai-track]", e);
      }
    })();
    // deno-lint-ignore no-explicit-any
    try { (globalThis as any).EdgeRuntime?.waitUntil?.(job); } catch { /* noop */ }
    return res;
  };
}
