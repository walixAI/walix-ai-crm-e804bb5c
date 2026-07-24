// Helpers para <input type="datetime-local">.
export function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export function fromLocalInput(v: string): string {
  // v = "YYYY-MM-DDTHH:mm" in local time
  return new Date(v).toISOString();
}