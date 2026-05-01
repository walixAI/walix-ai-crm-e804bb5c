import { create } from "zustand";
import { askAi, type AiAction, type ProposedChange, type AskAiContext, type CandidateGroup } from "@/services/ai";

export interface AiQuery {
  id: string;
  prompt: string;
  answer: string;
  actions: AiAction[];
  proposals: ProposedChange[];
  candidates?: CandidateGroup | null;
  at: string;
  context?: AskAiContext;
}

/** A persisted multi-turn conversation. */
export interface AiConversation {
  id: string;
  title: string;
  turns: AiQuery[];
  updatedAt: string; // ISO
}

interface AiDrawerState {
  open: boolean;
  loading: boolean;
  /** Persisted, resumable conversations (newest first, max 8). */
  history: AiConversation[];
  /** Active conversation turns (oldest → newest). `current` = last turn for backwards-compat. */
  turns: AiQuery[];
  /** ID of the active conversation (links live `turns` to a persisted `AiConversation`). */
  activeConversationId: string | null;
  /** True once the user has sent at least one prompt in the current conversation, regardless of success. */
  hasStarted: boolean;
  current: AiQuery | null;
  source: "live" | "error" | null;
  errorMessage: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  ask: (prompt: string, context?: AskAiContext) => void;
  retry: () => void;
  clearConversation: () => void;
  resumeConversation: (id: string) => void;
}

const STORAGE_KEY = "walix.aiDrawer.history.v2";
const LEGACY_KEY = "walix.aiDrawer.history.v1";
const MAX_HISTORY = 8;

function loadHistory(): AiConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AiConversation[];
    // One-time migration from v1 (flat AiQuery[])
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const arr = JSON.parse(legacy) as AiQuery[];
      const migrated: AiConversation[] = arr.map((q) => ({
        id: q.id,
        title: q.prompt.slice(0, 60),
        turns: [q],
        updatedAt: new Date().toISOString(),
      }));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      window.localStorage.removeItem(LEGACY_KEY);
      return migrated;
    }
    return [];
  } catch { return []; }
}

function persistHistory(history: AiConversation[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch { /* ignore */ }
}

export const useAiDrawer = create<AiDrawerState>((set, get) => ({
  open: false,
  loading: false,
  history: loadHistory(),
  turns: [],
  activeConversationId: null,
  hasStarted: false,
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
    set({ open: true, loading: true, hasStarted: true, source: null, errorMessage: null });
    const result = await askAi({ prompt, history: apiHistory, context });
    const q: AiQuery = {
      id: crypto.randomUUID(),
      prompt,
      answer: result.text,
      actions: result.actions ?? [],
      proposals: result.proposals ?? [],
      candidates: result.candidates ?? null,
      at: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      context,
    };
    // Append to active conversation. Failed turns aren't appended to the live thread.
    const newTurns = result.source === "live" ? [...turnsNow, q] : turnsNow;
    let history = get().history;
    let activeId = get().activeConversationId;
    if (result.source === "live") {
      const nowIso = new Date().toISOString();
      if (!activeId) {
        // Start a new persisted conversation on the first successful turn.
        const conv: AiConversation = {
          id: crypto.randomUUID(),
          title: prompt.slice(0, 60),
          turns: newTurns,
          updatedAt: nowIso,
        };
        activeId = conv.id;
        history = [conv, ...history].slice(0, MAX_HISTORY);
      } else {
        // Upsert existing conversation (move to top, refresh turns).
        const existing = history.find((c) => c.id === activeId);
        const updated: AiConversation = existing
          ? { ...existing, turns: newTurns, updatedAt: nowIso }
          : {
              id: activeId,
              title: prompt.slice(0, 60),
              turns: newTurns,
              updatedAt: nowIso,
            };
        history = [updated, ...history.filter((c) => c.id !== activeId)].slice(0, MAX_HISTORY);
      }
      persistHistory(history);
    }
    set({
      loading: false,
      turns: newTurns,
      current: q,
      history,
      activeConversationId: activeId,
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
  clearConversation: () => set({
    turns: [],
    activeConversationId: null,
    hasStarted: false,
    current: null,
    source: null,
    errorMessage: null,
  }),
  resumeConversation: (id: string) => {
    const conv = get().history.find((c) => c.id === id);
    if (!conv || conv.turns.length === 0) return;
    set({
      open: true,
      turns: conv.turns,
      activeConversationId: conv.id,
      current: conv.turns[conv.turns.length - 1],
      hasStarted: true,
      source: "live",
      errorMessage: null,
    });
  },
}));
