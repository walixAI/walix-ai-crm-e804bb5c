export type Role = "super_admin" | "tenant_admin" | "sales_manager" | "sales_rep";

export const tenant = {
  name: "Tacos El Güero",
  plan: "Pro",
};

export const kpis = [
  { label: "Pipeline activo", value: "$ 482,300", delta: "+12.4%", trend: "up", hint: "vs. semana pasada" },
  { label: "Conversaciones hoy", value: "1,284", delta: "+8.2%", trend: "up", hint: "47 sin responder" },
  { label: "Tasa de cierre", value: "23.8%", delta: "+2.1pp", trend: "up", hint: "Promedio mensual" },
  { label: "Tiempo de respuesta", value: "2m 14s", delta: "-18%", trend: "up", hint: "Meta < 5min" },
];

export const pipelineByStage = [
  { stage: "Nuevo", value: 124, amount: 84200 },
  { stage: "Contactado", value: 86, amount: 121800 },
  { stage: "Cotizado", value: 42, amount: 156400 },
  { stage: "Negociación", value: 21, amount: 89200 },
  { stage: "Cerrado", value: 14, amount: 30700 },
];

export const weeklyMessages = [
  { day: "Lun", in: 320, out: 280 },
  { day: "Mar", in: 412, out: 365 },
  { day: "Mié", in: 380, out: 340 },
  { day: "Jue", in: 510, out: 470 },
  { day: "Vie", in: 624, out: 580 },
  { day: "Sáb", in: 489, out: 410 },
  { day: "Dom", in: 210, out: 180 },
];

export const topAgents = [
  { name: "María López", deals: 28, revenue: 124500, avatar: "ML" },
  { name: "Carlos Ruiz", deals: 24, revenue: 108200, avatar: "CR" },
  { name: "Ana Torres", deals: 19, revenue: 89400, avatar: "AT" },
  { name: "Diego Pérez", deals: 16, revenue: 71300, avatar: "DP" },
];

export const recentConversations = [
  { id: "1", name: "Lucía Hernández", last: "¿Tienen entrega para mañana?", time: "hace 2 min", unread: 3, tag: "Cotizando" },
  { id: "2", name: "Restaurante La Plaza", last: "Mándame el catálogo por favor", time: "hace 8 min", unread: 1, tag: "Nuevo" },
  { id: "3", name: "Pedro Sánchez", last: "Perfecto, hago la transferencia", time: "hace 15 min", unread: 0, tag: "Cerrando" },
  { id: "4", name: "Mariana Vega", last: "Quiero 2 docenas más", time: "hace 32 min", unread: 0, tag: "Recompra" },
  { id: "5", name: "Hotel Misión", last: "Pásame la cotización formal", time: "hace 1 h", unread: 2, tag: "Cotizando" },
];

export const aiSuggestions = [
  "¿Cuánto vale mi pipeline hoy?",
  "Muéstrame los 5 leads más calientes",
  "Resume las conversaciones sin responder",
  "¿Qué vendedor cerró más esta semana?",
];