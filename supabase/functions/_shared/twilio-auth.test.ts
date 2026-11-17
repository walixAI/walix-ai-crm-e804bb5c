import { describe, it, expect } from "vitest";
import { validTwilioSignature } from "./twilio-auth";
describe("Twilio callback authentication", () => {
  it("rejects unsigned and forged events", async () => {
    expect(await validTwilioSignature("https://walix.test", {}, null, "test-token")).toBe(false);
    expect(await validTwilioSignature("https://walix.test", {}, "forged", "test-token")).toBe(false);
  });
  it("accepts the exact signed URL and fields only", async () => {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-token"), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("https://walix.testCallStatuscompleted")))));
    expect(await validTwilioSignature("https://walix.test", { CallStatus: "completed" }, sig, "test-token")).toBe(true);
    expect(await validTwilioSignature("https://walix.test", { CallStatus: "failed" }, sig, "test-token")).toBe(false);
  });
});