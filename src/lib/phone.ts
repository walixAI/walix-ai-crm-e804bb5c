// Mirror of supabase/functions/_shared/phone.ts for client-side normalization.
// Keep in sync if you change the rules.

export function digitsOnly(input: string | null | undefined): string {
  return (input ?? "").replace(/\D+/g, "");
}

export function toE164(input: string | null | undefined): string {
  const d = digitsOnly(input);
  if (!d) return "";
  if (d.startsWith("52") && d.length === 13 && d[2] === "1") return "+52" + d.slice(3);
  if (d.startsWith("54") && d.length === 13 && d[2] === "9") return "+54" + d.slice(3);
  return "+" + d;
}

export function toWaId(input: string | null | undefined): string {
  const e = toE164(input);
  if (!e) return "";
  const d = e.slice(1);
  if (d.startsWith("52") && d.length === 12) return "52" + "1" + d.slice(2);
  if (d.startsWith("54") && d.length === 12) return "54" + "9" + d.slice(2);
  return d;
}