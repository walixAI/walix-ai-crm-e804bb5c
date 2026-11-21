import { describe, it, expect } from "vitest";
import { buildAdvisorScreenTwiml } from "./telephony-provider";
describe("confirmación del asesor", () => {
  it("no marca al cliente hasta que el asesor presione 1", () => {
    const x = buildAdvisorScreenTwiml("https://x.test/wh?a=1&leg=advisor-accept");
    expect(x).toContain('<Gather numDigits="1"');
    expect(x).toContain("leg=advisor-accept");
    expect(x).not.toContain("<Dial");
  });
});
