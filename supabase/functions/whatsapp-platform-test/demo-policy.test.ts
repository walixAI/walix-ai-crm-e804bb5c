import { expect, it } from "vitest";
import { PLATFORM_DEMOS_ENABLED, disabledDemoResponse } from "./demo-policy";

it("keeps platform demos disabled until an explicit deployment enables them", async () => {
  expect(PLATFORM_DEMOS_ENABLED).toBe(false);
  const response = disabledDemoResponse({ "Access-Control-Allow-Origin": "*" });
  expect(response?.status).toBe(403);
  expect(await response?.json()).toEqual({ error: "Las pruebas de WhatsApp para demos están apagadas." });
});