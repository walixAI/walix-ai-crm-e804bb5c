// Base de conocimiento de Walix.ai — usada por el copiloto en modo Tutor/Guía.
// Contenido curado en español (es-MX), orientado a "cómo se hace" dentro del CRM.

export interface GuideTopic {
  id: string;
  title: string;
  route: string;
  keywords: string[];
  summary: string;
  steps: string[];
  tips?: string[];
}

export const WALIX_GUIDE: GuideTopic[] = [
  {
    id: "inicio",
    title: "Dashboard / Inicio",
    route: "/dashboard",
    keywords: ["dashboard", "inicio", "kpi", "tarjetas", "widgets", "personalizar", "gráficas", "reportes"],
    summary: "Vista general del negocio: ventas del mes, pipeline, run rate, rentabilidad y actividad del equipo.",
    steps: [
      "Entra a Inicio en el menú lateral.",
      "Usa el botón Personalizar para elegir qué tarjetas ves y en qué orden.",
      "Filtra las gráficas por periodo, usuario o pipeline con los filtros superiores.",
      "Descarga el reporte de actividad en CSV desde la tarjeta de Actividad.",
    ],
    tips: ["Cada usuario puede tener su propio arreglo de tarjetas."],
  },
  {
    id: "mi-dia",
    title: "Mi Día",
    route: "/mi-dia",
    keywords: ["mi dia", "mi día", "agenda", "hoy", "pendientes", "tareas del dia", "registrar"],
    summary: "Tu lista operativa del día: tareas vencidas y de hoy, seguimientos sugeridos y run rate del mes.",
    steps: [
      "Abre Mi Día para ver tus pendientes ordenados por urgencia.",
      "Usa Registrar para capturar un seguimiento de un contacto o deal existente, o crear uno nuevo al vuelo.",
      "Al marcar el resultado de una gestión (sin contacto, interesado, etc.) Walix sugiere la fecha de reagenda; confírmala o cámbiala.",
    ],
  },
  {
    id: "contactos",
    title: "Contactos",
    route: "/contacts",
    keywords: ["contactos", "clientes", "leads", "prospectos", "ciclo de vida", "etiquetas", "importar"],
    summary: "Directorio de clientes y prospectos con ciclo de vida (prospecto, cliente, cliente inactivo, inactivo).",
    steps: [
      "Ve a Contactos y usa el buscador o los filtros por estado, etiqueta y responsable.",
      "Abre un contacto para ver su historial: conversaciones, oportunidades, tareas y notas.",
      "Desde la ficha puedes crear una oportunidad, agendar tarea o enviar WhatsApp.",
      "Para cargas masivas usa Importar y mapea las columnas de tu Excel/CSV.",
    ],
    tips: ["El ciclo de vida se actualiza solo según ventas ganadas y días de inactividad configurados en Ajustes."],
  },
  {
    id: "pipeline",
    title: "Pipeline y oportunidades",
    route: "/pipeline",
    keywords: ["pipeline", "oportunidades", "deals", "etapas", "embudo", "probabilidad", "ganado", "perdido"],
    summary: "Tablero de oportunidades por etapa, con monto, probabilidad y fecha estimada de cierre.",
    steps: [
      "Arrastra la tarjeta entre etapas o abre el detalle para editar monto, fecha y responsable.",
      "Al registrar un resultado de actividad, la etapa puede avanzar automáticamente o sugerirte el cambio, según la configuración del tenant.",
      "Marca Ganado o Perdido y elige el motivo de pérdida para alimentar el análisis.",
      "Usa la vista Desempeño para ver el embudo y las conversiones por etapa.",
    ],
  },
  {
    id: "whatsapp",
    title: "WhatsApp / Inbox",
    route: "/whatsapp",
    keywords: ["whatsapp", "inbox", "mensajes", "conversaciones", "ventana 24", "plantillas", "por responder"],
    summary: "Bandeja unificada de WhatsApp Business con ventana de servicio de 24 h y control de créditos.",
    steps: [
      "Abre WhatsApp y elige la conversación; la pestaña Por responder muestra las pendientes.",
      "Si la ventana de 24 h está abierta puedes escribir libre; si está cerrada, el mensaje se cobra como conversación nueva.",
      "Desde el chat puedes abrir el contacto, ver sus deals y pedirle al copiloto una respuesta sugerida.",
    ],
  },
  {
    id: "tareas",
    title: "Tareas y seguimientos",
    route: "/tasks",
    keywords: ["tareas", "seguimiento", "recordatorio", "reagendar", "vencidas"],
    summary: "Tareas asignadas a usuarios, con vencimiento y vínculo a contacto u oportunidad.",
    steps: [
      "Crea la tarea desde el contacto, el deal o Mi Día.",
      "Al completarla registra el resultado para que Walix sugiera el siguiente paso.",
    ],
  },
  {
    id: "gastos",
    title: "Gastos y rentabilidad",
    route: "/expenses",
    keywords: ["gastos", "costos", "rentabilidad", "margen", "utilidad", "categorías", "recurrentes"],
    summary: "Registro de gastos por categoría, ligados a ventas o mantenimientos, base del indicador de rentabilidad.",
    steps: [
      "Ve a Gastos y registra el monto, categoría, fecha y (si aplica) la oportunidad relacionada.",
      "Configura gastos recurrentes para que se generen solos cada mes.",
      "El margen aparece en la tarjeta de Rentabilidad en Inicio.",
    ],
    tips: ["Un vendedor solo ve sus gastos; el administrador ve los de todo el tenant."],
  },
  {
    id: "metas",
    title: "Metas y Run Rate",
    route: "/settings",
    keywords: ["meta", "metas", "objetivo", "run rate", "pronóstico", "proyección", "cuota"],
    summary: "Meta mensual del negocio, repartida entre usuarios; el Run Rate proyecta el cierre del mes.",
    steps: [
      "Entra a Configuración → Metas y define la meta del mes.",
      "Asigna el porcentaje o monto por vendedor (Walix puede sugerir el reparto).",
      "El Run Rate compara lo vendido al día de hoy contra el ritmo necesario para llegar a la meta.",
    ],
  },
  {
    id: "importar",
    title: "Importar datos",
    route: "/settings/import",
    keywords: ["importar", "carga", "excel", "csv", "migración", "histórico"],
    summary: "Importador universal de contactos, oportunidades, tareas y gastos desde Excel o CSV.",
    steps: [
      "Descarga la plantilla o sube tu archivo.",
      "Mapea cada columna al campo de Walix y valida la vista previa.",
      "Ejecuta la carga; si algo sale mal puedes revertir el lote completo.",
    ],
  },
  {
    id: "usuarios",
    title: "Usuarios, roles y permisos",
    route: "/settings/organization",
    keywords: ["usuarios", "roles", "permisos", "invitar", "vendedor", "administrador", "equipo"],
    summary: "Alta de usuarios por invitación y control de lo que ve cada rol.",
    steps: [
      "Ve a Configuración → Mi organización → Invitar usuario.",
      "El invitado recibe un correo, crea su contraseña y entra ya ligado a la empresa.",
      "El administrador ve todo el tenant; el vendedor solo su cartera (contactos, deals, gastos y consumo propios).",
    ],
  },
  {
    id: "automatizaciones",
    title: "Automatizaciones y recurrencias",
    route: "/automations",
    keywords: ["automatizaciones", "recurrencias", "mantenimientos", "recordatorios automáticos", "agentes"],
    summary: "Reglas que generan tareas, deals o avisos solos: mantenimientos periódicos, silencio de deals, recordatorios.",
    steps: [
      "Abre Automatizaciones y activa o edita la regla.",
      "Para servicios periódicos (mantenimientos, cambio de filtro) define la frecuencia en el contacto o la recurrencia.",
      "Walix avisa con anticipación configurable antes de la fecha programada.",
    ],
  },
  {
    id: "copiloto",
    title: "Copiloto Walix (web y WhatsApp)",
    route: "/dashboard",
    keywords: ["copiloto", "copilot", "ia", "asistente", "whatsapp bot", "capacidades"],
    summary: "Asistente que consulta y opera el CRM por chat: pendientes, pipeline, rentabilidad, crear contactos/deals/tareas y redactar WhatsApp.",
    steps: [
      "Ábrelo con el botón flotante en cualquier pantalla, o escríbele por WhatsApp si tu número está autorizado.",
      "Pídele datos ('cómo voy este mes') o acciones ('crea una tarea para Tania mañana 10am').",
      "Los envíos de WhatsApp siempre requieren tu confirmación.",
      "En Configuración → Copiloto puedes crear nuevas capacidades y definir quién tiene acceso.",
    ],
  },
  {
    id: "facturacion",
    title: "Plan, créditos y facturación",
    route: "/settings/billing",
    keywords: ["plan", "créditos", "facturación", "consumo", "ia", "whatsapp créditos", "paquetes"],
    summary: "Plan contratado, consumo de créditos de WhatsApp e IA por usuario y solicitud de paquetes adicionales.",
    steps: [
      "Entra a Configuración → Facturación para ver tu plan y consumo del mes.",
      "Revisa el desglose de IA y WhatsApp por usuario (solo administradores).",
      "Si necesitas más créditos usa Solicitar a Walix y el equipo te contacta.",
    ],
  },
];

export function searchGuide(query: string): GuideTopic[] {
  const q = (query ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!q.trim()) return WALIX_GUIDE;
  const score = (t: GuideTopic) => {
    const hay = [t.id, t.title, t.summary, ...t.keywords].join(" ").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let s = 0;
    for (const w of q.split(/\s+/).filter((w) => w.length > 2)) if (hay.includes(w)) s++;
    return s;
  };
  const ranked = WALIX_GUIDE.map((t) => ({ t, s: score(t) })).filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s).map((r) => r.t);
  return ranked.length ? ranked.slice(0, 3) : WALIX_GUIDE.slice(0, 5);
}

export function guideIndex(): { id: string; title: string; route: string }[] {
  return WALIX_GUIDE.map(({ id, title, route }) => ({ id, title, route }));
}
