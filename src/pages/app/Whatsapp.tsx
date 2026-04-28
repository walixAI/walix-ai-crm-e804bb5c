import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/hooks/use-toast";
import {
  useConversations, useMessages, useMessageTemplates,
  useSendMessage, useUpdateConversation, useMarkConversationRead,
} from "@/lib/queries/whatsapp";
import { ConversationList } from "@/components/whatsapp/ConversationList";
import { ChatHeader } from "@/components/whatsapp/ChatHeader";
import { MessageList } from "@/components/whatsapp/MessageList";
import { Composer } from "@/components/whatsapp/Composer";
import { ContactSidePanel } from "@/components/whatsapp/ContactSidePanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function Whatsapp() {
  const user = useAuthStore((s) => s.user);
  const isMobile = useIsMobile();

  const { data: conversations = [], isLoading: convLoading } = useConversations();
  const { data: templates = [] } = useMessageTemplates();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");

  // pick first conversation by default
  useEffect(() => {
    if (!activeId && conversations.length) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  // sync notes draft when switching conversations
  useEffect(() => {
    setNotesDraft(activeConv?.internalNotes ?? "");
    setDraft("");
  }, [activeConv?.id]); // eslint-disable-line

  const { data: messages = [], isLoading: msgsLoading } = useMessages(activeId);

  const sendMutation = useSendMessage();
  const updateMutation = useUpdateConversation();
  const markRead = useMarkConversationRead();

  // mark as read when opening
  useEffect(() => {
    if (activeConv && activeConv.unread > 0) {
      markRead.mutate(activeConv.id);
    }
  }, [activeConv?.id]); // eslint-disable-line

  const tenantId = (activeConv as any)?.tenant_id; // not exposed; we infer from current state below

  const handleSend = async (body: string, opts?: { internal?: boolean }) => {
    if (!activeConv || !user) return;
    // tenant_id: get from contact via current conversation by re-querying not ideal; use profile tenant from auth via user.user_metadata fallback
    // We rely on a single tenant per user — fetch it lazily
    try {
      // fetch tenant_id from profiles
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      const tid = profile?.tenant_id;
      if (!tid) {
        toast({ title: "Sin tenant", description: "No se pudo identificar tu organización.", variant: "destructive" });
        return;
      }
      await sendMutation.mutateAsync({
        conversationId: activeConv.id,
        tenantId: tid,
        body,
        isInternalNote: opts?.internal,
      });
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

  // Mobile flow: when a conv is selected, hide the list
  const showList = !isMobile || !activeId;
  const showChat = !isMobile || !!activeId;

  return (
    <div className="-m-4 md:-mx-6 md:-my-6 h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] flex bg-background overflow-hidden">
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
                />
                <MessageList messages={messages} loading={msgsLoading} />
                <Composer
                  draft={draft}
                  onDraftChange={setDraft}
                  templates={templates}
                  onSend={handleSend}
                  sending={sendMutation.isPending}
                  onAiSuggest={() => toast({ title: "IA", description: "Conectaremos esto en la fase 3." })}
                  onAiSummarize={() => toast({ title: "IA", description: "Conectaremos esto en la fase 3." })}
                  onAiPrompt={() => toast({ title: "IA", description: "Conectaremos esto en la fase 3." })}
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
            />
          )}
        </main>
      )}
    </div>
  );
}
