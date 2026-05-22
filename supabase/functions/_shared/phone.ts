// Phone normalization helpers for WhatsApp.
// Two formats:
//   e164  -> canonical, stored in DB. e.g. "+525517278186"
//   waId  -> what Meta uses in wa_id and expects in `to`. e.g. "5215517278186"
// Country quirks:
//   MX (+52): Meta inserts a legacy mobile "1" between country code and the
//             10-digit national number. Strip it for canonical, re-add for waId.
//   AR (+54): same idea with a legacy mobile "9".
//   BR (+55): the leading "9" is part of the national number, do not touch.

export function digitsOnly(input: string | null | undefined): string {
  return (input ?? "").replace(/\D+/g, "");
}

/** Canonical E.164 with leading "+". Returns "" if input is empty. */
export function toE164(input: string | null | undefined): string {
  const d = digitsOnly(input);
  if (!d) return "";
  // MX: 52 + 1 + 10 digits  -> drop the "1"
  if (d.startsWith("52") && d.length === 13 && d[2] === "1") {
    return "+52" + d.slice(3);
  }
  // AR: 54 + 9 + 10 digits  -> drop the "9"
  if (d.startsWith("54") && d.length === 13 && d[2] === "9") {
    return "+54" + d.slice(3);
  }
  return "+" + d;
}

/** Format Meta expects in `to` / returns in `wa_id`. No leading "+". */
export function toWaId(input: string | null | undefined): string {
  const e = toE164(input);
  if (!e) return "";
  const d = e.slice(1); // strip "+"
  if (d.startsWith("52") && d.length === 12) return "52" + "1" + d.slice(2);
  if (d.startsWith("54") && d.length === 12) return "54" + "9" + d.slice(2);
  return d;
}

/** All plausible DB-stored variants for an inbound wa_id, to match legacy rows. */
export function phoneMatchVariants(input: string | null | undefined): string[] {
  const d = digitsOnly(input);
  if (!d) return [];
  const e164 = toE164(d);
  const waId = toWaId(d);
  const set = new Set<string>([e164, "+" + d, d, waId]);
  set.delete("");
  return Array.from(set);
}