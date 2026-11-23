import { describe, it, expect } from "vitest";
import { isInternalTestEmail } from "./internalUsers";
describe("isInternalTestEmail", () => {
  it("excluye qa.refrigeracion@walix-test.io", () => expect(isInternalTestEmail("qa.refrigeracion@walix-test.io")).toBe(true));
  it("no excluye usuarios reales", () => expect(isInternalTestEmail("refrigeraciongonzalezrodriguez@gmail.com")).toBe(false));
});
