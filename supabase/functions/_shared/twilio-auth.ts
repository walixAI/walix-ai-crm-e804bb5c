export async function validTwilioSignature(url: string, fields: Record<string, string>, signature: string | null, authToken: string) {
  if (!signature || !authToken) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const message = url + Object.keys(fields).sort().map((k) => k + fields[k]).join("");
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  const expected = btoa(String.fromCharCode(...bytes));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export async function twilioRequest(creds: Record<string, string>, path: string, fields?: URLSearchParams) {
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}/${path}`, {
    method: fields ? "POST" : "GET",
    headers: { Authorization: "Basic " + btoa(`${creds.api_key_sid}:${creds.api_key_secret}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: fields,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    // Twilio errors can echo credentials; expose only the provider code.
    throw new Error(`Twilio rechazó la solicitud (${response.status}, código ${body.code ?? "desconocido"})`);
  }
  return response.json();
}