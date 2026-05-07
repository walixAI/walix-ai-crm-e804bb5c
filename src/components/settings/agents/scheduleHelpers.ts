export type SchedulePreset = "daily" | "twice_daily" | "weekdays" | "mondays";

export const PRESET_LABELS: Record<SchedulePreset, string> = {
  daily: "Diario",
  twice_daily: "Dos veces al día",
  weekdays: "Solo días hábiles",
  mondays: "Solo lunes",
};

function pad(n: number) { return n.toString().padStart(2, "0"); }

export function buildCron(preset: SchedulePreset, time: string, time2 = "18:00"): string {
  const [h, m] = time.split(":").map(Number);
  const [h2] = time2.split(":").map(Number);
  switch (preset) {
    case "daily":       return `${m} ${h} * * *`;
    case "weekdays":    return `${m} ${h} * * 1-5`;
    case "mondays":     return `${m} ${h} * * 1`;
    case "twice_daily": return `${m} ${h},${h2} * * 1-5`;
  }
}

export function parseCron(expr: string): { preset: SchedulePreset; time: string; time2: string } {
  const parts = (expr || "").trim().split(/\s+/);
  if (parts.length !== 5) return { preset: "weekdays", time: "09:00", time2: "18:00" };
  const [mStr, hStr, , , dow] = parts;
  const m = Number(mStr) || 0;
  const hours = hStr.split(",").map((x) => Number(x) || 0);
  const time = `${pad(hours[0])}:${pad(m)}`;
  const time2 = hours[1] != null ? `${pad(hours[1])}:${pad(m)}` : "18:00";
  if (hours.length > 1 && dow === "1-5") return { preset: "twice_daily", time, time2 };
  if (dow === "1-5") return { preset: "weekdays", time, time2 };
  if (dow === "1")   return { preset: "mondays", time, time2 };
  return { preset: "daily", time, time2 };
}

export function describeCron(expr: string): string {
  const { preset, time, time2 } = parseCron(expr);
  switch (preset) {
    case "daily":       return `Todos los días a las ${time}`;
    case "weekdays":    return `Lunes a viernes a las ${time}`;
    case "mondays":     return `Solo lunes a las ${time}`;
    case "twice_daily": return `Lunes a viernes a las ${time} y ${time2}`;
  }
}

/** Returns the next run timestamp from now() for the supported presets. */
export function nextRunFromCron(expr: string): Date | null {
  const parts = (expr || "").trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [mStr, hStr, , , dow] = parts;
  const m = Number(mStr) || 0;
  const hours = hStr.split(",").map((x) => Number(x)).filter((x) => !Number.isNaN(x));
  const matchDow = (jsDay: number) => {
    // JS: Sun=0..Sat=6; cron: Mon=1..Sun=7 (1-5 = Mon-Fri)
    const iso = jsDay === 0 ? 7 : jsDay;
    if (dow === "*") return true;
    if (dow === "1-5") return iso >= 1 && iso <= 5;
    return Number(dow) === iso;
  };
  const now = new Date();
  for (let d = 0; d < 14; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    if (!matchDow(day.getDay())) continue;
    for (const h of hours) {
      const cand = new Date(day);
      cand.setHours(h, m, 0, 0);
      if (cand.getTime() > now.getTime()) return cand;
    }
  }
  return null;
}