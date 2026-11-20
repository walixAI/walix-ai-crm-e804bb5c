export function validateReceivingPreference(enabled: unknown, phone: unknown, channelNumbers: string[] = []) {
  if (typeof enabled !== "boolean") return { error: "Elige si deseas recibir en tu celular" };
  if (phone !== null && phone !== undefined && typeof phone !== "string") return { error: "Ingresa un celular válido" };
  const normalized = typeof phone === "string" ? phone.trim().replace(/[\s()-]/g, "") : null;
  if (normalized && !/^\+[1-9]\d{7,14}$/.test(normalized)) return { error: "Ingresa tu celular con código de país, por ejemplo +52 y 10 dígitos" };
  if (enabled && !normalized) return { error: "Guarda tu celular antes de activar la recepción" };
  if (normalized && channelNumbers.includes(normalized)) return { error: "Ingresa tu celular personal, no un número de Walix" };
  return { enabled, phone: normalized || null };
}