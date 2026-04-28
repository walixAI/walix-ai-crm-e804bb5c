export const kpiData = [
  {
    label: "Valor del Pipeline",
    value: "$248,500",
    suffix: "MXN",
    delta: "+12%",
    trend: "up" as const,
    hint: "vs ayer",
    icon: "wallet",
  },
  {
    label: "Deals Activos",
    value: "23",
    suffix: "deals",
    delta: "8",
    trend: "down" as const,
    hint: "sin actividad hoy",
    icon: "target",
  },
  {
    label: "Mensajes WhatsApp",
    value: "47",
    suffix: "hoy",
    delta: "12",
    trend: "down" as const,
    hint: "sin respuesta",
    icon: "message",
  },
  {
    label: "Tasa de Cierre",
    value: "34%",
    suffix: "",
    delta: "+3pts",
    trend: "up" as const,
    hint: "este mes",
    icon: "trending",
  },
];

export const recentActivity = [
  { id: "a1", agent: "ML", agentName: "María López", action: "movió a Negociación", target: "Restaurante La Plaza", type: "deal", time: "hace 3 min" },
  { id: "a2", agent: "CR", agentName: "Carlos Ruiz", action: "envió cotización a", target: "Hotel Misión", type: "message", time: "hace 12 min" },
  { id: "a3", agent: "AT", agentName: "Ana Torres", action: "creó contacto", target: "Lucía Hernández", type: "contact", time: "hace 18 min" },
  { id: "a4", agent: "ML", agentName: "María López", action: "agregó nota a", target: "Pedro Sánchez", type: "note", time: "hace 24 min" },
  { id: "a5", agent: "DP", agentName: "Diego Pérez", action: "cerró deal con", target: "Mariana Vega", type: "won", time: "hace 41 min" },
  { id: "a6", agent: "CR", agentName: "Carlos Ruiz", action: "respondió WA a", target: "Tienda Don Beto", type: "message", time: "hace 1 h" },
  { id: "a7", agent: "AT", agentName: "Ana Torres", action: "movió a Propuesta", target: "Café Central", type: "deal", time: "hace 2 h" },
  { id: "a8", agent: "ML", agentName: "María López", action: "agendó demo con", target: "Distribuidora Norte", type: "note", time: "hace 3 h" },
  { id: "a9", agent: "DP", agentName: "Diego Pérez", action: "creó contacto", target: "Roberto Salinas", type: "contact", time: "hace 4 h" },
  { id: "a10", agent: "CR", agentName: "Carlos Ruiz", action: "envió propuesta a", target: "Panadería La Esquina", type: "message", time: "hace 5 h" },
];

export const aiDailySuggestions = [
  {
    id: "s1",
    text: "Carlos Méndez lleva 8 días sin contacto — envíale un WA ahora",
    cta: "Enviar WA",
  },
  {
    id: "s2",
    text: "3 deals en Propuesta superaron 5 días — riesgo de enfriamiento",
    cta: "Ver deals",
  },
  {
    id: "s3",
    text: "Tu mejor día de cierre es jueves — agenda demos hoy",
    cta: "Agendar",
  },
];

export const pipelineByStageMXN = [
  { stage: "Nuevo Lead", value: 32000 },
  { stage: "Contactado", value: 58000 },
  { stage: "Calificado", value: 84000 },
  { stage: "Propuesta", value: 124000 },
  { stage: "Negociación", value: 96000 },
  { stage: "Cerrado", value: 64000 },
];

export const dealsClosedTimeline = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const base = 8000 + Math.sin(i / 3) * 4000 + (i * 250);
  const noise = Math.cos(i * 1.7) * 3000;
  return {
    day: `${day}`,
    value: Math.max(2000, Math.round(base + noise)),
  };
});

export const atRiskDealsCount = 3;
