import { create } from "zustand";

export interface AiQuery {
  id: string;
  prompt: string;
  answer: string;
  at: string;
}

interface AiDrawerState {
  open: boolean;
  loading: boolean;
  history: AiQuery[];
  current: AiQuery | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  ask: (prompt: string) => void;
}

const mockAnswer = (prompt: string) => {
  const p = prompt.toLowerCase();
  if (p.includes("caliente") || p.includes("lead")) {
    return `**Tus 5 leads más calientes ahora:**\n\n1. **Restaurante La Plaza** — Cotización de $42k, respondió hace 2h.\n2. **Hotel Misión** — Pidió propuesta formal, score 94/100.\n3. **Lucía Hernández** — Lleva 3 mensajes sin cerrar, pregunta por entrega.\n4. **Pedro Sánchez** — Confirmó transferencia, cierra hoy.\n5. **Distribuidora Norte** — Demo agendada esta semana.\n\n*Sugerencia: enfócate en 1, 2 y 4 antes de las 6pm.*`;
  }
  if (p.includes("pipeline") || p.includes("vale")) {
    return `**Tu pipeline activo vale $248,500 MXN.**\n\n- 23 deals abiertos · 8 sin actividad hoy\n- Etapa con más valor: **Propuesta** ($124k)\n- Tasa de cierre proyectada: **34%** → ~$84k cerrarían este mes\n\n*Riesgo: 3 deals llevan más de 10 días estancados.*`;
  }
  if (p.includes("vendedor") || p.includes("equipo")) {
    return `**Top vendedores esta semana:**\n\n1. **María López** — 28 cierres · $124.5k\n2. **Carlos Ruiz** — 24 cierres · $108.2k\n3. **Ana Torres** — 19 cierres · $89.4k\n\nMaría va 15% arriba de su meta mensual.`;
  }
  return `Analicé tus datos. Aquí lo más relevante para **"${prompt}"**:\n\n- Tienes 47 conversaciones de WhatsApp hoy, 12 sin responder.\n- Pipeline activo de $248,500 MXN con 23 deals.\n- 3 deals llevan +10 días sin actividad — revísalos.\n\n¿Quieres que profundice en alguno?`;
};

export const useAiDrawer = create<AiDrawerState>((set, get) => ({
  open: false,
  loading: false,
  history: [],
  current: null,
  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
  ask: (prompt: string) => {
    if (!prompt.trim()) return;
    set({ open: true, loading: true, current: null });
    setTimeout(() => {
      const q: AiQuery = {
        id: crypto.randomUUID(),
        prompt,
        answer: mockAnswer(prompt),
        at: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      };
      const history = [q, ...get().history].slice(0, 5);
      set({ loading: false, current: q, history });
    }, 700);
  },
}));
