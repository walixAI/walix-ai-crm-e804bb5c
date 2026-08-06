import { create } from "zustand";
import { runCopilot, type CopilotToolUse, type CopilotPendingWhatsapp } from "@/services/ai";
import { supabase } from "@/integrations/supabase/client";
import { logDraftEdit } from "@/services/userProfile";

export type CopilotStatus = "idle" | "thinking" | "executing";

export type CopilotMessage =
  | { id: string; role: "user"; text: string; at: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      toolsUsed: CopilotToolUse[];
      pendingWhatsapp: (CopilotPendingWhatsapp & { contactName?: string }) | null;
      whatsappStatus?: "pending" | "sent" | "cancelled";
      sentAt?: string;
      at: string;
    };

interface CopilotState {
  open: boolean;
  status: CopilotStatus;
  messages: CopilotMessage[];
  conversationKey: string;
  entity: { type: "contact" | "deal" | "conversation"; id: string } | null;
  loadedKeys: Record<string, boolean>;
  proactiveCount: number;

  openDrawer: () => void;
  closeDrawer: () => void;
  setContext: (opts: {
    conversationKey: string;
    entity: CopilotState["entity"];
  }) => void;
  loadHistoryForCurrentKey: () => Promise<void>;
  send: (text: string) => Promise<void>;
  newConversation: () => void;
  confirmWhatsapp: (msgId: string, draft: string) => Promise<void>;
  cancelWhatsapp: (msgId: string) => void;
  refreshProactiveCount: () => Promise<void>;
}

function nowTime() {
  return new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export const useCopilot = create<CopilotState>((set, get) => ({
  open: false,
  status: "idle",
  messages: [],
  conversationKey: "global",
  entity: null,
  loadedKeys: {},
  proactiveCount: 0,

  openDrawer: () => {
    set({ open: true });
    void get().loadHistoryForCurrentKey();
  },
  closeDrawer: () => set({ open: false }),

  setContext: ({ conversationKey, entity }) => {
    if (conversationKey === get().conversationKey) {
      set({ entity });
      return;
    }
    set({ conversationKey, entity, messages: [] });
    if (get().open) void get().loadHistoryForCurrentKey();
  },

  loadHistoryForCurrentKey: async () => {
    const key = get().conversationKey;
    if (get().loadedKeys[key]) return;
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data, error } = await supabase
        .from("ai_conversation_history")
        .select("id, role, content, tool_calls, created_at")
        .eq("user_id", u.user.id)
        .eq("session_id", key)
        .order("created_at", { ascending: true })
        .limit(40);
      if (error) throw error;
      const msgs: CopilotMessage[] = [];
      let pendingTools: CopilotToolUse[] = [];
      for (const row of (data ?? []) as any[]) {
        const at = new Date(row.created_at).toLocaleTimeString("es-MX", {
          hour: "2-digit", minute: "2-digit",
        });
        if (row.role === "user") {
          pendingTools = [];
          msgs.push({ id: row.id, role: "user", text: String(row.content ?? ""), at });
          continue;
        }
        // Las filas "tool" guardan el JSON crudo del resultado: nunca se muestran
        // como texto, se convierten en tarjetas visuales del siguiente mensaje.
        if (row.role === "tool") {
          let result: any = null;
          try { result = JSON.parse(String(row.content ?? "null")); } catch { result = null; }
          const name = row.tool_calls?.name;
          if (name) pendingTools.push({ name, args: {}, result } as CopilotToolUse);
          continue;
        }
        const text = String(row.content ?? "").trim();
        // Turno intermedio del modelo (solo pidió herramientas, sin texto): no se muestra.
        if (!text && Array.isArray(row.tool_calls) && row.tool_calls.length) continue;
        if (!text && pendingTools.length === 0) continue;
        msgs.push({
          id: row.id,
          role: "assistant",
          text,
          toolsUsed: pendingTools,
          pendingWhatsapp: null,
          at,
        });
        pendingTools = [];
      }
      set((s) => ({
        messages: msgs,
        loadedKeys: { ...s.loadedKeys, [key]: true },
      }));
    } catch (err) {
      console.warn("[copilot.loadHistory]", err);
    }
  },

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().status !== "idle") return;
    const userMsg: CopilotMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
      at: nowTime(),
    };
    set((s) => ({
      messages: [...s.messages, userMsg],
      status: "thinking",
      open: true,
    }));
    // Switch to executing once first response chunk would arrive (no streaming yet — flip after small delay).
    const flipTimer = setTimeout(() => {
      if (get().status === "thinking") set({ status: "executing" });
    }, 1200);
    const { entity, conversationKey } = get();
    const turn = await runCopilot({
      message: trimmed,
      conversationKey,
      entityType: entity?.type ?? null,
      entityId: entity?.id ?? null,
    });
    clearTimeout(flipTimer);
    let pendingWa: CopilotMessage extends infer T ? T : never;
    let pendingWithName: (CopilotPendingWhatsapp & { contactName?: string }) | null = null;
    if (turn.pendingWhatsapp) {
      pendingWithName = { ...turn.pendingWhatsapp };
      try {
        const { data: c } = await supabase
          .from("contacts")
          .select("name")
          .eq("id", turn.pendingWhatsapp.contact_id)
          .maybeSingle();
        if (c?.name) pendingWithName.contactName = c.name;
      } catch { /* noop */ }
    }
    const assistantMsg: CopilotMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: turn.text,
      toolsUsed: turn.toolsUsed,
      pendingWhatsapp: pendingWithName,
      whatsappStatus: pendingWithName ? "pending" : undefined,
      at: nowTime(),
    };
    set((s) => ({
      messages: [...s.messages, assistantMsg],
      status: "idle",
    }));
  },

  newConversation: () => {
    const ts = Date.now();
    const baseKey = get().conversationKey.split(":fresh:")[0];
    const newKey = `${baseKey}:fresh:${ts}`;
    set((s) => ({
      conversationKey: newKey,
      messages: [],
      loadedKeys: { ...s.loadedKeys, [newKey]: true },
    }));
  },

  confirmWhatsapp: async (msgId, draft) => {
    const msg = get().messages.find((m) => m.id === msgId);
    if (!msg || msg.role !== "assistant" || !msg.pendingWhatsapp) return;
    const contactId = msg.pendingWhatsapp.contact_id;
    const originalDraft = msg.pendingWhatsapp.draft ?? "";
    if (originalDraft && draft && originalDraft !== draft) {
      void logDraftEdit({ original: originalDraft, edited: draft, contactId }).catch(() => {});
    }
    try {
      // Resolve or create open conversation for this contact.
      const { data: convo } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", contactId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let conversationId = convo?.id as string | undefined;
      if (!conversationId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("active_tenant_id, tenant_id")
          .maybeSingle();
        const tenantId = prof?.active_tenant_id ?? prof?.tenant_id;
        if (!tenantId) throw new Error("No tenant");
        const { data: newConvo, error } = await supabase
          .from("conversations")
          .insert({ contact_id: contactId, tenant_id: tenantId, status: "Nuevo" })
          .select("id")
          .single();
        if (error) throw error;
        conversationId = newConvo.id;
      }
      const { error: sendErr } = await supabase.functions.invoke("whatsapp-send", {
        body: { conversation_id: conversationId, body: draft },
      });
      if (sendErr) throw sendErr;
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === msgId && m.role === "assistant"
            ? { ...m, whatsappStatus: "sent", sentAt: nowTime() }
            : m,
        ),
      }));
    } catch (err) {
      console.warn("[copilot.confirmWhatsapp]", err);
      throw err;
    }
  },

  cancelWhatsapp: (msgId) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === msgId && m.role === "assistant"
          ? { ...m, whatsappStatus: "cancelled" }
          : m,
      ),
    }));
  },

  refreshProactiveCount: async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { count } = await supabase
        .from("ai_proactive_suggestions")
        .select("*", { count: "exact", head: true })
        .eq("target_user_id", u.user.id)
        .eq("dismissed", false);
      set({ proactiveCount: count ?? 0 });
    } catch { /* noop */ }
  },
}));