export type LeadStatus = "Nuevo" | "Contactado" | "Calificado" | "En negociación" | "Cliente" | "Inactivo";
export type Source = "WhatsApp" | "Formulario web" | "Referido" | "Manual";

export interface Contact {
  id: string;
  name: string;
  lastName?: string;
  phone: string;
  email?: string;
  company?: string;
  position?: string;
  status: LeadStatus;
  source: Source;
  tags: string[];
  ownerId: string;
  ownerName: string;
  ownerInitials: string;
  lastActivity: string; // ISO
  createdAt: string;
  avatarColor: string;
}

export const sellers = [
  { id: "u1", name: "María López", initials: "ML", color: "hsl(239 84% 60%)" },
  { id: "u2", name: "Carlos Ruiz", initials: "CR", color: "hsl(189 94% 43%)" },
  { id: "u3", name: "Ana Torres", initials: "AT", color: "hsl(38 92% 50%)" },
  { id: "u4", name: "Diego Pérez", initials: "DP", color: "hsl(142 71% 45%)" },
];

export const allTags = ["cliente", "prospecto", "inactivo", "vip", "frio", "caliente", "recompra"];

const firstNames = ["Lucía", "Pedro", "Mariana", "Roberto", "Sofía", "Andrés", "Gabriela", "José", "Laura", "Miguel", "Patricia", "Javier", "Daniela", "Ricardo", "Karla", "Fernando", "Adriana", "Sergio", "Valeria", "Eduardo", "Paola", "Héctor", "Ximena", "Raúl", "Beatriz"];
const lastNames = ["Hernández", "García", "Martínez", "Rodríguez", "Sánchez", "Ramírez", "López", "González", "Pérez", "Torres", "Flores", "Vega", "Ortiz", "Castillo", "Mendoza"];
const companies = ["Tacos El Güero", "Restaurante La Plaza", "Hotel Misión", "Ferretería Norte", "Boutique Andrea", "Café Central", "Distribuidora MX", "Refaccionaria San Juan", "Panadería Doña Lupe", "Lavandería Express", "—"];
const statuses: LeadStatus[] = ["Nuevo", "Contactado", "Calificado", "En negociación", "Cliente", "Inactivo"];
const sources: Source[] = ["WhatsApp", "Formulario web", "Referido", "Manual"];
const colors = ["hsl(239 84% 60%)", "hsl(189 94% 43%)", "hsl(38 92% 50%)", "hsl(142 71% 45%)", "hsl(280 70% 55%)", "hsl(0 75% 60%)"];

function rand<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }

export const contacts: Contact[] = Array.from({ length: 127 }, (_, i) => {
  const fn = firstNames[i % firstNames.length];
  const ln = lastNames[(i * 3) % lastNames.length];
  const seller = sellers[i % sellers.length];
  const daysAgo = Math.floor(Math.random() * 60);
  const created = new Date(Date.now() - (daysAgo + 30) * 86400000).toISOString();
  const last = new Date(Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 86400000)).toISOString();
  const tagPool = allTags.slice(0, 2 + (i % 3));
  return {
    id: `c${i + 1}`,
    name: fn,
    lastName: ln,
    phone: `+52 55 ${String(1000 + (i * 137) % 9000)} ${String(1000 + (i * 211) % 9000)}`,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}@mail.mx`,
    company: companies[i % companies.length],
    position: rand(["Gerente", "Dueño", "Compras", "Director", "Asistente"]),
    status: statuses[i % statuses.length],
    source: sources[i % sources.length],
    tags: [tagPool[i % tagPool.length], tagPool[(i + 1) % tagPool.length]].filter(Boolean),
    ownerId: seller.id,
    ownerName: seller.name,
    ownerInitials: seller.initials,
    lastActivity: last,
    createdAt: created,
    avatarColor: colors[i % colors.length],
  };
});

export const statusColor: Record<LeadStatus, "info" | "warning" | "brand" | "warning" | "success" | "neutral"> = {
  "Nuevo": "info",
  "Contactado": "warning",
  "Calificado": "brand",
  "En negociación": "warning",
  "Cliente": "success",
  "Inactivo": "neutral",
};

export const statusBadgeClass: Record<LeadStatus, string> = {
  "Nuevo": "bg-info/10 text-info border-info/20",
  "Contactado": "bg-warning/10 text-warning border-warning/20",
  "Calificado": "bg-purple-500/10 text-purple-500 border-purple-500/20 dark:text-purple-400",
  "En negociación": "bg-orange-500/10 text-orange-500 border-orange-500/20 dark:text-orange-400",
  "Cliente": "bg-success/10 text-success border-success/20",
  "Inactivo": "bg-muted text-muted-foreground border-border",
};

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} día${d > 1 ? "s" : ""}`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} mes${mo > 1 ? "es" : ""}`;
}

export interface Activity {
  id: string;
  type: "wa_sent" | "wa_received" | "note" | "deal" | "task";
  description: string;
  timestamp: string;
  agent: string;
  agentInitials: string;
}

export function getContactActivity(contactId: string): Activity[] {
  return [
    { id: "a1", type: "wa_sent", description: "Le enviaste el catálogo de productos", timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), agent: "María López", agentInitials: "ML" },
    { id: "a2", type: "note", description: "Mostró interés en propuesta de $25,000 MXN", timestamp: new Date(Date.now() - 24 * 3600000).toISOString(), agent: "María López", agentInitials: "ML" },
    { id: "a3", type: "deal", description: "Movió el deal a etapa 'Negociación'", timestamp: new Date(Date.now() - 2 * 86400000).toISOString(), agent: "Carlos Ruiz", agentInitials: "CR" },
    { id: "a4", type: "wa_received", description: "Respondió: '¿Manejan financiamiento?'", timestamp: new Date(Date.now() - 3 * 86400000).toISOString(), agent: "—", agentInitials: "•" },
    { id: "a5", type: "task", description: "Tarea completada: Enviar cotización", timestamp: new Date(Date.now() - 5 * 86400000).toISOString(), agent: "María López", agentInitials: "ML" },
  ];
}

export function getContactDeals(contactId: string) {
  return [
    { id: "d1", name: "Paquete Premium", amount: 25000, stage: "Negociación", probability: 70 },
    { id: "d2", name: "Servicio mensual", amount: 8500, stage: "Calificado", probability: 40 },
  ];
}

export function getContactConversations(contactId: string) {
  return [
    { id: "wa1", preview: "Perfecto, mándame la cotización formal por favor", time: "hace 2 h", unread: 1 },
    { id: "wa2", preview: "¿Qué incluye el paquete premium?", time: "hace 1 día", unread: 0 },
    { id: "wa3", preview: "Hola, vi tu publicación en Facebook", time: "hace 5 días", unread: 0 },
  ];
}
