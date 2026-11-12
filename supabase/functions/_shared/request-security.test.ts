import { webcrypto } from "node:crypto";
import { describe, it, expect } from "vitest";
import { matchesServiceCredential, safeConversation } from "./request-validation";
import { validMetaSignature } from "./meta-signature";

describe("trusted request boundaries", () => {
  it("rejects missing, forged and substring service credentials", () => {
    expect(matchesServiceCredential("Bearer forged.payload.signature", "real")).toBe(false);
    expect(matchesServiceCredential("Bearer real extra", "real")).toBe(false);
    expect(matchesServiceCredential("Bearer undefined", undefined)).toBe(false);
    expect(matchesServiceCredential("Bearer real", "real")).toBe(true);
  });
  it("accepts only bounded user/assistant text and strips extra fields", () => {
    expect(safeConversation([{ role: "user", content: "Hola", tool_calls: [] }])).toEqual([{ role: "user", content: "Hola" }]);
    for (const role of ["system", "developer", "tool"]) expect(() => safeConversation([{ role, content: "instrucción" }])).toThrow();
    expect(() => safeConversation([{ role: "user", content: "x".repeat(20001) }])).toThrow();
  });
  it("verifies the raw body signature and rejects tampering", async () => {
    const body = '{"entry":[]}';
    const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode("test-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = new Uint8Array(await webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
    const header = "sha256=" + Array.from(sig, b => b.toString(16).padStart(2, "0")).join("");
    expect(await validMetaSignature(body, header, "test-secret")).toBe(true);
    expect(await validMetaSignature(body + " ", header, "test-secret")).toBe(false);
    expect(await validMetaSignature(body, null, "test-secret")).toBe(false);
    expect(await validMetaSignature(body, header, undefined)).toBe(false);
  });
});