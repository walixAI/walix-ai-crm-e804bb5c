import { describe, expect, it, vi, afterEach } from "vitest";
import { buildDialTwiml, getTelephonyProvider } from "./telephony-provider";

const CREDS = { account_sid: "AC123", api_key_sid: "SK123", api_key_secret: "supersecret" };
const CHANNEL = { provider: "twilio", phone_number: "+525512345678", credentials: CREDS };

describe("Twilio click-to-call", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("marks the advisor first and dials the lead only after the advisor answers", async () => {
    const sent: { url: string; body: URLSearchParams }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
      sent.push({ url, body: init.body as URLSearchParams });
      return new Response(JSON.stringify({ sid: "CA1" }), { status: 200 });
    }));

    const provider = getTelephonyProvider(CHANNEL);
    const started = await provider.startCall("+525599998888", "+525512345678", {
      bridgingTo: "+525511112222",
      statusCallbackUrl: "https://x.test/telephony-webhook?token=t",
    });

    expect(started.providerCallId).toBe("CA1");
    expect(sent[0].url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Calls.json");
    expect(sent[0].body.get("To")).toBe("+525511112222");
    expect(sent[0].body.get("From")).toBe("+525512345678");
    expect(sent[0].body.get("StatusCallback")).toBe("https://x.test/telephony-webhook?token=t");
    expect(sent[0].body.get("Twiml")).toContain("+525599998888");
  });

  it("refuses to place a call when the advisor has no phone on file", async () => {
    const provider = getTelephonyProvider(CHANNEL);
    await expect(provider.startCall("+525599998888", "+525512345678", {}))
      .rejects.toThrow("Configura tu teléfono en tu perfil");
  });

  it("refuses to place a call when the channel has no credentials", async () => {
    const provider = getTelephonyProvider({ ...CHANNEL, credentials: null });
    await expect(provider.startCall("+525599998888", "+525512345678", { bridgingTo: "+525511112222" }))
      .rejects.toThrow("Canal Twilio sin credenciales configuradas");
  });

  it("announces the recording notice and records both legs only when recording is on", () => {
    const withRec = buildDialTwiml({
      lead: "+525599998888",
      record: true,
      notice: "Esta llamada puede ser grabada.",
      recordingCallbackUrl: "https://x.test/wh?token=t",
    });
    expect(withRec).toContain('<Say language="es-mx">Esta llamada puede ser grabada.</Say>');
    expect(withRec).toContain('record="record-from-answer-dual"');
    expect(withRec).toContain('recordingStatusCallback="https://x.test/wh?token=t"');

    const noRec = buildDialTwiml({ lead: "+525599998888", record: false });
    expect(noRec).not.toContain("record=");
    expect(noRec).not.toContain("<Say");
  });

  it("escapes a notice with XML characters so the TwiML stays valid", () => {
    expect(buildDialTwiml({ lead: "+52", record: false, notice: "A & B <C>" })).toContain("A &amp; B &lt;C&gt;");
  });

  it("keeps an unknown provider on the simulated channel that places no real call", async () => {
    const provider = getTelephonyProvider({ provider: "otro", phone_number: null, credentials: null });
    const started = await provider.startCall("+525599998888", null);
    expect(started.providerCallId).toMatch(/^sim_/);
  });
});
