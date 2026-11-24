/** Date-only CRM filters cover complete days in the report's Mexico City timezone.
 * Timestamp inputs retain their exact instant; database DATE columns must stay date-only.
 */
export function dateBoundary(value: string, edge: "start" | "end"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}-06:00`).toISOString();
}

export function nextDateBoundary(value: string): Date {
  return new Date(new Date(dateBoundary(value, "end")).getTime() + 1);
}

/** Existing browser-local monthly periods retain their timezone and include the last millisecond. */
export function localDayEnd(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

export function mexicoDateKey(value: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}