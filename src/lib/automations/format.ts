import { TRIGGERS, ACTIONS, OPERATORS, CONDITION_FIELDS, type AutomationCondition, type AutomationAction } from "./registry";

export function describeTrigger(triggerType: string, config: Record<string, any>): string {
  const t = TRIGGERS.find((x) => x.type === triggerType);
  if (!t) return triggerType;
  let txt = t.title.toLowerCase();
  if (config?.days) txt = txt.replace("días", `${config.days} días`);
  return txt;
}

export function describeConditions(conds: AutomationCondition[] | undefined): string {
  if (!conds || conds.length === 0) return "";
  return conds
    .map((c, i) => {
      const f = CONDITION_FIELDS.find((x) => x.value === c.field);
      const op = OPERATORS.find((x) => x.value === c.operator);
      const prefix = i === 0 ? "" : ` ${c.logic ?? "AND"} `;
      return `${prefix}${f?.label ?? c.field} ${op?.label ?? c.operator} ${c.value}`;
    })
    .join("");
}

export function describeActions(actions: AutomationAction[] | undefined): string {
  if (!actions || actions.length === 0) return "ninguna acción";
  return actions
    .map((a) => ACTIONS.find((x) => x.type === a.type)?.title.toLowerCase() ?? a.type)
    .join(" y ");
}

export function describeAutomation(triggerType: string, triggerConfig: any, conds: AutomationCondition[], actions: AutomationAction[]): string {
  const trig = describeTrigger(triggerType, triggerConfig);
  const cond = describeConditions(conds);
  const act = describeActions(actions);
  if (cond) return `Cuando ${trig}, solo si ${cond}, entonces ${act}.`;
  return `Cuando ${trig}, entonces ${act}.`;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "nunca";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString("es-MX");
}