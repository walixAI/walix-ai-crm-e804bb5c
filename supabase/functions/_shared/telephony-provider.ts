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

export interface TelephonyProvider {
  startCall(to: string, from: string | null): Promise<StartCallResult>;
  endCall(providerCallId: string): Promise<void>;
}

class SimulatedProvider implements TelephonyProvider {
  async startCall(): Promise<StartCallResult> {
    return { providerCallId: `sim_${crypto.randomUUID()}`, status: "ringing" };
  }
  async endCall(): Promise<void> {}
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

export function getTelephonyProvider(cfg: TelephonyChannelConfig): TelephonyProvider {
  switch (cfg.provider) {
    case "telnyx":
      return new TelnyxProvider(cfg);
    case "simulated":
    default:
      return new SimulatedProvider();
  }
}
