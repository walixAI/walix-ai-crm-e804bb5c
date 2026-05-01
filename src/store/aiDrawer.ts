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
  /** Active conversation turns (oldest → newest). `current` = last turn for backwards-compat. */
  turns: AiQuery[];
  current: AiQuery | null;
  source: "live" | "error" | null;
  errorMessage: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  ask: (prompt: string, context?: AskAiContext) => void;
  retry: () => void;
  clearConversation: () => void;
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
  turns: [],
  current: null,
  source: null,
  errorMessage: null,
  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
  ask: async (prompt: string, context?: AskAiContext) => {
    if (!prompt.trim()) return;
    // Build conversational history from current active turns (oldest→newest).
    // Send up to last 6 messages (3 user + 3 assistant) for context.
    const turnsNow = get().turns;
    const apiHistory = turnsNow.flatMap((h) => [
      { role: "user" as const, content: h.prompt },
      { role: "assistant" as const, content: h.answer },
    ]).slice(-6);
    set({ open: true, loading: true, source: null, errorMessage: null });
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
    // Append to active conversation. Persist only the FIRST successful turn of a
    // new conversation in the recent-history sidebar (so the list stays useful).
    const newTurns = result.source === "live"
      ? [...turnsNow, q]
      : turnsNow; // don't pollute the thread with failed turns
    let history = get().history;
    if (result.source === "live" && turnsNow.length === 0) {
      history = [q, ...history].slice(0, 5);
      persistHistory(history);
    }
    set({
      loading: false,
      turns: newTurns,
      current: q,
      history,
      source: result.source,
      errorMessage: result.errorMessage ?? null,
    });
  },
  retry: () => {
    const c = get().current;
    if (!c) return;
    // Pop the failed turn (only present on success); on error we never appended it.
    void get().ask(c.prompt, c.context);
  },
  clearConversation: () => set({ turns: [], current: null, source: null, errorMessage: null }),
}));
