import { create } from "zustand";
import { askAi, type AiAction, type ProposedChange, type AskAiContext } from "@/services/ai";

export interface AiQuery {
  id: string;
  prompt: string;
  answer: string;
  actions: AiAction[];
  proposals: ProposedChange[];
  at: string;
  context?: AskAiContext;
}

interface AiDrawerState {
  open: boolean;
  loading: boolean;
  history: AiQuery[];
  current: AiQuery | null;
  source: "live" | "error" | null;
  errorMessage: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  ask: (prompt: string, context?: AskAiContext) => void;
  retry: () => void;
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
  errorMessage: null,
  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
  ask: async (prompt: string, context?: AskAiContext) => {
    if (!prompt.trim()) return;
    set({ open: true, loading: true, current: null, source: null, errorMessage: null });
    const recent = get().history.slice(0, 2).reverse();
    const apiHistory = recent.flatMap((h) => [
      { role: "user" as const, content: h.prompt },
      { role: "assistant" as const, content: h.answer },
    ]);
    const result = await askAi({ prompt, history: apiHistory, context });
    const q: AiQuery = {
      id: crypto.randomUUID(),
      prompt,
      answer: result.text,
      actions: result.actions ?? [],
      proposals: result.proposals ?? [],
      at: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      context,
    };
    // Only persist successful answers in history.
    const history = result.source === "live" ? [q, ...get().history].slice(0, 5) : get().history;
    if (result.source === "live") persistHistory(history);
    set({
      loading: false,
      current: q,
      history,
      source: result.source,
      errorMessage: result.errorMessage ?? null,
    });
  },
  retry: () => {
    const c = get().current;
    if (!c) return;
    void get().ask(c.prompt, c.context);
  },
}));
