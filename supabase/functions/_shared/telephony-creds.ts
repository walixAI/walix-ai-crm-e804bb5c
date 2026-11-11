// Credenciales de telefonía cifradas en reposo con AES-GCM.
// Solo se leen dentro de las funciones del backend; nunca viajan al navegador.
const SECRET_KEYS = ["TELEPHONY_CRED_SECRET", "EMAIL_CRED_SECRET"];

async function aesKey(): Promise<CryptoKey> {
  let raw: string | undefined;
  for (const k of SECRET_KEYS) {
    raw = Deno.env.get(k);
    if (raw) break;
  }
  if (!raw) throw new Error("No hay clave configurada para cifrar credenciales de telefonía");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptCredentials(creds: Record<string, string>): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(JSON.stringify(creds))),
  );
  const buf = new Uint8Array(iv.length + ct.length);
  buf.set(iv);
  buf.set(ct, iv.length);
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
}

export async function decryptCredentials(stored: string): Promise<Record<string, string>> {
  let parsed: unknown;
  try {
    const buf = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: buf.subarray(0, 12) },
      await aesKey(),
      buf.subarray(12),
    );
    parsed = JSON.parse(new TextDecoder().decode(pt));
  } catch {
    throw new Error("No se pudieron leer las credenciales del canal de llamadas");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("No se pudieron leer las credenciales del canal de llamadas");
  }
  return parsed as Record<string, string>;
}
