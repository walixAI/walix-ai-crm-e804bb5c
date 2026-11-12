import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRetiredQaRequest } from "./index.ts";

Deno.test("retired QA endpoint rejects account administration regardless of credentials", async () => {
  for (const authorization of ["", "Bearer invalid-session"]) {
    const response = handleRetiredQaRequest(new Request("https://example.test/qa-create-user", {
      method: "POST", headers: { authorization },
      body: JSON.stringify({ email: "controlled@example.test", password: "not-a-real-credential", role: "tenant_owner" }),
    }));
    assertEquals(response.status, 410);
  }
});