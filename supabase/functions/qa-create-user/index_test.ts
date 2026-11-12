import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("retired QA endpoint rejects account administration regardless of credentials", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  let handler: ((req: Request) => Response) | undefined;
  const run = new Function("Deno", source.replace("export function", "function"));
  run({ serve: (fn: (req: Request) => Response) => { handler = fn; } });
  if (!handler) throw new Error("Missing handler");
  for (const authorization of ["", "Bearer invalid-session"]) {
    const response = handler(new Request("https://example.test/qa-create-user", {
      method: "POST", headers: { authorization },
      body: JSON.stringify({ email: "controlled@example.test", password: "not-a-real-credential", role: "tenant_owner" }),
    }));
    assertEquals(response.status, 410);
  }
});