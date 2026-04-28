import { create } from "zustand";
import { askAi } from "@/services/ai";

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
  source: "live" | "fallback" | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  ask: (prompt: string) => void;
}

const STORAGE_KEY = "walix.aiDrawer.history.v1";

function loadHistory(): AiQuery[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AiQuery[]) : [];
  } catch { return []; }
}

function persistHistory(history: AiQuery[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch { /* ignore */ }
}

export const useAiDrawer = create<AiDrawerState>((set, get) => ({
  open: false,
  loading: false,
  history: loadHistory(),
  current: null,
  source: null,
  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
  ask: async (prompt: string) => {
    if (!prompt.trim()) return;
    set({ open: true, loading: true, current: null, source: null });
    const recent = get().history.slice(0, 2).reverse();
    const apiHistory = recent.flatMap((h) => [
      { role: "user" as const, content: h.prompt },
      { role: "assistant" as const, content: h.answer },
    ]);
    const result = await askAi({ prompt, history: apiHistory });
    const q: AiQuery = {
      id: crypto.randomUUID(),
      prompt,
      answer: result.text,
      at: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
    };
    const history = [q, ...get().history].slice(0, 5);
    persistHistory(history);
    set({ loading: false, current: q, history, source: result.source });
  },
}));
