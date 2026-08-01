import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Search, Loader2, User, Clock, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import type { ConversationItem } from "@/lib/queries/whatsapp";
import { useMessageSearch } from "@/lib/queries/whatsapp";
import { getServiceWindow } from "@/lib/whatsapp/serviceWindow";
import { ConversationListSkeleton } from "@/components/walix/Skeletons";

type Tab = "all" | "mine" | "unassigned" | "resolved";

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

interface Props {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  myUserId: string | null;
  loading?: boolean;
}

export function ConversationList({ conversations, activeId, onSelect, myUserId, loading }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const term = q.trim();
  const { data: matchingConvIds, isFetching: searching } = useMessageSearch(term);

  const filtered = useMemo(() => {
    let list = conversations;
    if (tab === "mine") list = list.filter((c) => c.assigneeId === myUserId);
    if (tab === "unassigned") list = list.filter((c) => !c.assigneeId);
    if (tab === "resolved") list = list.filter((c) => c.status === "Resuelto");
    if (tab === "all") list = list.filter((c) => c.status !== "Resuelto");
    const lower = term.toLowerCase();
    if (lower) {
      list = list.filter(
        (c) =>
          c.contactName.toLowerCase().includes(lower) ||
          c.preview.toLowerCase().includes(lower) ||
          c.contactPhone.includes(lower) ||
          (matchingConvIds?.has(c.id) ?? false),
      );
    }
    return list;
  }, [conversations, tab, term, myUserId, matchingConvIds]);

  const totalUnread = conversations.reduce((s, c) => s + (c.unread ?? 0), 0);

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "mine", label: "Mis chats" },
    { id: "unassigned", label: "Sin asignar" },
    { id: "resolved", label: "Resueltos" },
  ];

  return (
    <aside className="w-full md:w-[320px] md:shrink-0 border-r border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-success/10 text-success flex items-center justify-center">
            <MessageCircle className="h-4 w-4" />
          </div>
          <h2 className="font-semibold flex-1">WhatsApp</h2>
          {totalUnread > 0 && (
            <span className="text-xs font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
              {totalUnread}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-1 bg-muted rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 text-[11px] font-medium px-2 py-1.5 rounded-md transition",
                tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nombre o mensaje…"
            className="pl-9 h-9 text-sm"
          />
          {term.length >= 2 && searching && (
            <Loader2 className="h-3.5 w-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
          )}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {loading && <ConversationListSkeleton rows={8} />}
        {!loading && filtered.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">Sin conversaciones</div>
        )}
        <ul className="divide-y divide-border">
          {filtered.map((c) => {
            const active = c.id === activeId;
            const win = getServiceWindow(c.lastInboundAt);
            return (
              <li key={c.id} className="relative group">
                <button
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/60 transition",
                    active && "bg-primary/5 hover:bg-primary/5",
                  )}
                >
                  {/* Avatar + assignee */}
                  <div className="relative shrink-0">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                      style={{ background: c.avatarColor }}
                    >
                      {c.initials}
                    </div>
                    {c.assigneeId && (
                      <div
                        className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card flex items-center justify-center text-[8px] font-bold text-white"
                        style={{ background: c.assigneeColor }}
                        title={c.assigneeName}
                      >
                        {c.assigneeInitials}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate flex-1">{c.contactName}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(c.lastAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.preview}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <StatusBadge status={c.status} />
                      <span
                        title={win.description}
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                          win.charging && "bg-destructive/10 text-destructive border-destructive/40",
                          !win.charging && win.tone === "open" && "bg-success/10 text-success border-success/30",
                          !win.charging && win.tone === "closing" && "bg-warning/10 text-warning border-warning/30",
                        )}
                      >
                        {win.charging ? (
                          <>
                            <CreditCard className="h-3 w-3" />
                            Con costo
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3" />
                            {win.shortLabel}
                          </>
                        )}
                      </span>
                      {c.unread > 0 && (
                        <span className="ml-auto text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                {c.contactId && (
                  <button
                    type="button"
                    title="Ver contacto"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/contacts/${c.contactId}`);
                    }}
                    className="absolute right-2 top-2 h-7 w-7 rounded-md grid place-items-center text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-muted hover:text-foreground transition"
                  >
                    <User className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </aside>
  );
}
