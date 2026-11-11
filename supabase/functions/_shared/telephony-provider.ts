// Capa neutra de telefonía: una interfaz, adaptadores intercambiables.
// Para cambiar de proveedor solo se cambia la configuración del canal.

export interface TelephonyChannelConfig {
  provider: string; // 'simulated' | 'telnyx' | 'twilio'
  phone_number: string | null;
  credentials: Record<string, string> | null;
}

export interface StartCallResult {
  providerCallId: string | null;
  status: string; // queued | ringing
}

export interface StartCallOptions {
  /** Teléfono del asesor que marca: se marca primero a él y, al contestar, se conecta al lead. */
  bridgingTo?: string | null;
  /** Grabar la llamada (ambas piernas). */
  recordCalls?: boolean;
  /** Aviso de grabación que se anuncia al iniciar la llamada. */
  recordingNotice?: string | null;
  /** URL de callback de estado del proveedor. */
  statusCallbackUrl?: string | null;
}

export interface TelephonyProvider {
  startCall(to: string, from: string | null, opts?: StartCallOptions): Promise<StartCallResult>;
  endCall(providerCallId: string): Promise<void>;
}

class SimulatedProvider implements TelephonyProvider {
  async startCall(): Promise<StartCallResult> {
    return { providerCallId: `sim_${crypto.randomUUID()}`, status: "ringing" };
  }
  async endCall(): Promise<void> {}
}

/**
 * TwiML de click-to-call: la primera pierna es el asesor y la segunda el lead.
 * El aviso de grabación se anuncia antes de marcar, y la grabación arranca al contestar.
 */
export function buildDialTwiml(o: { lead: string; record: boolean; notice?: string | null }): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const say = o.notice && o.notice.trim() ? `<Say language="es-mx">${esc(o.notice.trim())}</Say>` : "";
  const rec = o.record ? ' record="record-from-answer-dual"' : "";
  return `<Response>${say}<Dial timeout="30"${rec}><Number noWrap="true">${esc(o.lead)}</Number></Dial></Response>`;
}

class TelnyxProvider implements TelephonyProvider {
  constructor(private cfg: TelephonyChannelConfig) {}
  async startCall(to: string, from: string | null): Promise<StartCallResult> {
    const apiKey = this.cfg.credentials?.api_key;
    const connectionId = this.cfg.credentials?.connection_id;
    if (!apiKey || !connectionId) throw new Error("Canal Telnyx sin credenciales configuradas");
    const res = await fetch("https://api.telnyx.com/v2/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        connection_id: connectionId,
        to,
        from: from ?? this.cfg.phone_number,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telnyx [${res.status}]: ${body}`);
    }
    const data = await res.json();
    return { providerCallId: data?.data?.call_control_id ?? null, status: "queued" };
  }
  async endCall(providerCallId: string): Promise<void> {
    const apiKey = this.cfg.credentials?.api_key;
    if (!apiKey) return;
    await fetch(`https://api.telnyx.com/v2/calls/${providerCallId}/actions/hangup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: "{}",
    });
  }
}

class TwilioProvider implements TelephonyProvider {
  constructor(private cfg: TelephonyChannelConfig) {}

  private auth(): { accountSid: string; header: string } | null {
    const accountSid = this.cfg.credentials?.account_sid;
    const keySid = this.cfg.credentials?.api_key_sid;
    const keySecret = this.cfg.credentials?.api_key_secret;
    if (!accountSid || !keySid || !keySecret) return null;
    return { accountSid, header: "Basic " + btoa(`${keySid}:${keySecret}`) };
  }

  async startCall(to: string, from: string | null, opts: StartCallOptions = {}): Promise<StartCallResult> {
    const creds = this.auth();
    if (!creds) throw new Error("Canal Twilio sin credenciales configuradas");
    const fromNumber = (from ?? this.cfg.phone_number ?? "").trim();
    if (!fromNumber) throw new Error("El canal de llamadas no tiene número de origen");
    const advisor = (opts.bridgingTo ?? "").trim();
    if (!advisor) throw new Error("Configura tu teléfono en tu perfil para llamar desde Walix");

    const body = new URLSearchParams({
      To: advisor,
      From: fromNumber,
      Twiml: buildDialTwiml({ lead: to, record: !!opts.recordCalls, notice: opts.recordingNotice }),
    });
    if (opts.statusCallbackUrl) body.set("StatusCallback", opts.statusCallbackUrl);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Calls.json`, {
      method: "POST",
      headers: { Authorization: creds.header, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Twilio [${res.status}]: ${text}`);
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = {}; }
    return { providerCallId: data?.sid ?? null, status: "queued" };
  }

  async endCall(providerCallId: string): Promise<void> {
    const creds = this.auth();
    if (!creds) return;
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Calls/${providerCallId}.json`, {
      method: "POST",
      headers: { Authorization: creds.header, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ Status: "completed" }),
    });
  }
}

export function getTelephonyProvider(cfg: TelephonyChannelConfig): TelephonyProvider {
  switch (cfg.provider) {
    case "telnyx":
      return new TelnyxProvider(cfg);
    case "twilio":
      return new TwilioProvider(cfg);
    case "simulated":
    default:
      return new SimulatedProvider();
  }
}
