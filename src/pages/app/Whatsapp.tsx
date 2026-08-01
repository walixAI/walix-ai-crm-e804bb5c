import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, ChevronLeft } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/hooks/use-toast";
import {
  useConversations, useMessages, useMessageTemplates,
  useSendMessage, useUpdateConversation, useMarkConversationRead,
  useMarkConversationUnread, renderTemplate,
  type MessageTemplate,
} from "@/lib/queries/whatsapp";
import { useContactDeals } from "@/lib/queries/contacts";
import { ConversationList } from "@/components/whatsapp/ConversationList";
import { ChatHeader } from "@/components/whatsapp/ChatHeader";
import { MessageList } from "@/components/whatsapp/MessageList";
import { Composer } from "@/components/whatsapp/Composer";
import { ContactSidePanel } from "@/components/whatsapp/ContactSidePanel";
import { TemplatesDialog } from "@/components/whatsapp/TemplatesDialog";
import { LinkDealDialog } from "@/components/whatsapp/LinkDealDialog";
import { AiSummaryDialog } from "@/components/whatsapp/AiSummaryDialog";
import { useWhatsappAi } from "@/lib/queries/whatsappAi";
import { getServiceWindow } from "@/lib/whatsapp/serviceWindow";
import { getGuidance } from "@/lib/whatsapp/guidance";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/walix/EmptyState";
import { EmptyIllustration } from "@/components/walix/empty/EmptyIllustration";
import { useTenantUsers } from "@/lib/queries/tenantUsers";

export default function Whatsapp() {
  const user = useAuthStore((s) => s.user);
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: conversations = [], isLoading: convLoading } = useConversations();
  const { data: templates = [] } = useMessageTemplates();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [aiDraftActive, setAiDraftActive] = useState(false);

  // Open by deep link: ?conversationId=... or ?contactId=...
  // If contactId has no conversation yet, create one (Nuevo) on the fly.
  useEffect(() => {
    const convParam = searchParams.get("conversationId");
    const contactParam = searchParams.get("contactId");
    const draftParam = searchParams.get("draft");
    if (draftParam) {
      setDraft(draftParam);
      setAiDraftActive(true);
    }
    if (convParam) {
      setActiveId(convParam);
      const next = new URLSearchParams(searchParams);
      next.delete("conversationId");
      next.delete("draft");
      setSearchParams(next, { replace: true });
      return;
    }
    if (contactParam) {
      const existing = conversations.find((c) => c.contactId === contactParam);
      if (existing) {
        setActiveId(existing.id);
        const next = new URLSearchParams(searchParams);
        next.delete("contactId");
        next.delete("draft");
        setSearchParams(next, { replace: true });
        return;
      }
      // No conversation yet — create one for this contact.
      (async () => {
        const { data: prof } = await supabase
          .from("profiles").select("tenant_id").eq("id", user?.id ?? "").maybeSingle();
        const tid = prof?.tenant_id;
        if (!tid) return;
        const { data: created, error } = await supabase
          .from("conversations")
          .insert({ tenant_id: tid, contact_id: contactParam, status: "Nuevo" })
          .select("id").single();
        if (error || !created) {
          toast({ title: "No se pudo abrir la conversación", description: error?.message ?? "", variant: "destructive" as any });
          return;
        }
        setActiveId(created.id);
        const next = new URLSearchParams(searchParams);
        next.delete("contactId");
        next.delete("draft");
        setSearchParams(next, { replace: true });
      })();
      return;
    }
    if (draftParam) {
      const next = new URLSearchParams(searchParams);
      next.delete("draft");
      setSearchParams(next, { replace: true });
    }
    if (!activeId && conversations.length) setActiveId(conversations[0].id);
  }, [conversations, searchParams, user?.id]); // eslint-disable-line

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  // sync notes draft when switching conversations
  useEffect(() => {
    setNotesDraft(activeConv?.internalNotes ?? "");
    setDraft("");
    setAiDraftActive(false);
  }, [activeConv?.id]); // eslint-disable-line

  const { data: messages = [], isLoading: msgsLoading } = useMessages(activeId);

  const sendMutation = useSendMessage();
  const updateMutation = useUpdateConversation();
  const markRead = useMarkConversationRead();
  const markUnread = useMarkConversationUnread();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [linkDealOpen, setLinkDealOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const aiMutation = useWhatsappAi();
  const { data: sellers = [] } = useTenantUsers();

  // load tenant id once
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      setTenantId(data?.tenant_id ?? null);
    })();
  }, [user?.id]); // eslint-disable-line

  // pull deals of the active contact (for {monto} variable)
  const { data: contactDeals = [] } = useContactDeals(activeConv?.contactId);
  const topDeal = contactDeals[0] ?? null;

  function tplContext(): Parameters<typeof renderTemplate>[1] {
    const sellerName = sellers.find((s) => s.id === activeConv?.assigneeId)?.name;
    return {
      nombre: activeConv?.contactName.split(" ")[0],
      empresa: activeConv?.contactCompany ?? undefined,
      vendedor: sellerName ?? "",
      monto: topDeal?.amount ?? null,
    };
  }

  function pickTemplate(t: MessageTemplate) {
    setDraft(renderTemplate(t.content, tplContext()));
    setAiDraftActive(false);
    setTemplatesOpen(false);
  }

  // mark as read when opening
  useEffect(() => {
    if (activeConv && activeConv.unread > 0) {
      markRead.mutate(activeConv.id);
    }
  }, [activeConv?.id]); // eslint-disable-line

  const handleSend = async (body: string, opts?: { internal?: boolean }) => {
    if (!activeConv || !user) return;
    if (!tenantId) {
      toast({ title: "Sin tenant", description: "No se pudo identificar tu organización.", variant: "destructive" });
      return;
    }
    try {
      await sendMutation.mutateAsync({
        conversationId: activeConv.id,
        tenantId,
        body,
        isInternalNote: opts?.internal,
      });
      setAiDraftActive(false);
    } catch (e: any) {
      toast({ title: "Error al enviar", description: e?.message ?? "Intenta de nuevo", variant: "destructive" });
    }
  };

  const handleSaveNotes = async () => {
    if (!activeConv) return;
    await updateMutation.mutateAsync({
      id: activeConv.id,
      patch: { internal_notes: notesDraft },
    });
    toast({ title: "Nota guardada" });
  };

  const runAiSuggest = async () => {
    if (!activeConv) return;
    try {
      const text = await aiMutation.mutateAsync({
        mode: "suggest_reply",
        conversationId: activeConv.id,
        contactName: activeConv.contactName,
        contactCompany: activeConv.contactCompany,
      });
      setDraft(text);
      setAiDraftActive(true);
      toast({ title: "Sugerencia lista", description: "Revisa y edita antes de enviar." });
    } catch (e: any) {
      toast({ title: "IA no disponible", description: e?.message ?? "Intenta de nuevo", variant: "destructive" });
    }
  };

  const runAiSummarize = async () => {
    if (!activeConv) return;
    setSummaryOpen(true);
    setSummaryText(null);
    setSummaryError(null);
    try {
      const text = await aiMutation.mutateAsync({
        mode: "summarize",
        conversationId: activeConv.id,
        contactName: activeConv.contactName,
        contactCompany: activeConv.contactCompany,
      });
      setSummaryText(text);
    } catch (e: any) {
      setSummaryError(e?.message ?? "Error al generar resumen");
    }
  };

  const runAiPrompt = async (prompt: string) => {
    if (!activeConv) return;
    try {
      const text = await aiMutation.mutateAsync({
        mode: "custom_prompt",
        conversationId: activeConv.id,
        prompt,
        contactName: activeConv.contactName,
        contactCompany: activeConv.contactCompany,
      });
      setDraft(text);
      setAiDraftActive(true);
    } catch (e: any) {
      toast({ title: "IA no disponible", description: e?.message ?? "Intenta de nuevo", variant: "destructive" });
    }
  };

  // Nunca generamos ni enviamos nada automáticamente: solo señalamos al usuario
  // que conviene pedir una sugerencia cuando el cliente escribió y falta responder.
  const lastMsg = messages[messages.length - 1] ?? null;
  const serviceWindow = activeConv ? getServiceWindow(activeConv.lastInboundAt) : null;
  const guidance = activeConv
    ? getGuidance({
        lastDirection: lastMsg ? lastMsg.direction : null,
        hasInbound: messages.some((m) => m.direction === "inbound"),
        windowOpen: !!serviceWindow?.open,
      })
    : null;

  // Mobile flow: when a conv is selected, hide the list
  const showList = !isMobile || !activeId;
  const showChat = !isMobile || !!activeId;

  return (
    <div className="-m-4 md:-mx-6 md:-my-6 h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] flex bg-background overflow-hidden">
      {!convLoading && conversations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <EmptyState
            illustration={<EmptyIllustration variant="whatsapp" />}
            title="📱 Conecta tu WhatsApp Business"
            description="Conecta tu cuenta para recibir mensajes y responder desde el CRM."
            action={{ label: "Conectar WhatsApp", onClick: () => (window.location.href = "/settings") }}
          />
        </div>
      ) : (
      <>
      {showList && (
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => setActiveId(id)}
          myUserId={user?.id ?? null}
          loading={convLoading}
        />
      )}

      {showChat && (
        <main className="flex-1 flex min-w-0">
          <div className="flex-1 flex flex-col min-w-0">
            {!activeConv && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-3">
                  <MessageCircle className="h-8 w-8 text-success" />
                </div>
                <h3 className="font-semibold text-foreground">Selecciona una conversación</h3>
                <p className="text-sm mt-1 max-w-xs">
                  Cuando llegue un mensaje aparecerá aquí. También puedes elegir uno de la lista.
                </p>
              </div>
            )}

            {activeConv && (
              <>
                {isMobile && (
                  <div className="px-2 py-1 border-b border-border bg-card">
                    <Button variant="ghost" size="sm" onClick={() => setActiveId(null)} className="h-8 text-xs">
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Conversaciones
                    </Button>
                  </div>
                )}
                <ChatHeader
                  conv={activeConv}
                  panelOpen={panelOpen}
                  onTogglePanel={() => setPanelOpen((v) => !v)}
                  onChangeStatus={(status) =>
                    updateMutation.mutate({ id: activeConv.id, patch: { status } })
                  }
                  onChangeAssignee={(id) =>
                    updateMutation.mutate({ id: activeConv.id, patch: { assignee_id: id } })
                  }
                  onLinkDeal={() => setLinkDealOpen(true)}
                  onMarkUnread={() => {
                    markUnread.mutate(activeConv.id);
                    toast({ title: "Marcado como no leído" });
                  }}
                />
                <MessageList messages={messages} loading={msgsLoading} />
                <Composer
                  draft={draft}
                  onDraftChange={(v) => {
                    setDraft(v);
                    if (aiDraftActive) setAiDraftActive(false);
                  }}
                  templates={templates}
                  onSend={handleSend}
                  sending={sendMutation.isPending}
                  onOpenTemplates={() => setTemplatesOpen(true)}
                  onPickTemplate={pickTemplate}
                  onAiSuggest={runAiSuggest}
                  onAiSummarize={runAiSummarize}
                  onAiPrompt={runAiPrompt}
                  aiLoading={aiMutation.isPending}
                  aiDraftActive={aiDraftActive}
                  guidance={guidance}
                  windowNotice={
                    serviceWindow
                      ? { tone: serviceWindow.tone, text: serviceWindow.description }
                      : null
                  }
                  onClearAiDraft={() => { setDraft(""); setAiDraftActive(false); }}
                />
              </>
            )}
          </div>

          {activeConv && panelOpen && (
            <ContactSidePanel
              conv={activeConv}
              notesDraft={notesDraft}
              onNotesChange={setNotesDraft}
              onSaveNotes={handleSaveNotes}
              onLinkDeal={() => setLinkDealOpen(true)}
              guidance={guidance}
              onAiSuggest={runAiSuggest}
              onOpenTemplates={() => setTemplatesOpen(true)}
              aiLoading={aiMutation.isPending}
              serviceWindow={serviceWindow}
            />
          )}
        </main>
      )}
      </>
      )}

      <TemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        tenantId={tenantId}
        onUse={pickTemplate}
      />

      {activeConv && (
        <LinkDealDialog
          open={linkDealOpen}
          onOpenChange={setLinkDealOpen}
          conversationId={activeConv.id}
          contactId={activeConv.contactId}
          contactName={activeConv.contactName}
          currentDealId={activeConv.dealId}
        />
      )}

      <AiSummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        loading={aiMutation.isPending && !summaryText && !summaryError}
        summary={summaryText}
        error={summaryError}
        contactId={activeConv?.contactId ?? null}
        tenantId={tenantId}
      />
    </div>
  );
}
