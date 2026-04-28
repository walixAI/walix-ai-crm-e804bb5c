import { useEffect, useRef } from "react";
import { Check, CheckCheck, FileText, MapPin, Image as ImageIcon, Mic, StickyNote } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { MessageItem } from "@/lib/queries/whatsapp";
import { MessageListSkeleton } from "@/components/walix/Skeletons";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}
function dateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Hoy";
  if (same(d, yest)) return "Ayer";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

function MessageBubble({ m }: { m: MessageItem }) {
  const out = m.direction === "outbound";
  if (m.isInternalNote) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[75%] bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 text-xs text-foreground">
          <div className="flex items-center gap-1.5 text-warning font-medium mb-0.5">
            <StickyNote className="h-3 w-3" />
            Nota interna
          </div>
          <p className="whitespace-pre-wrap">{m.body}</p>
          <div className="text-[10px] text-muted-foreground mt-1 text-right">{formatTime(m.sentAt)}</div>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 shadow-sm",
          out ? "bg-primary/10 text-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm",
        )}
      >
        {m.type === "image" && m.mediaUrl && (
          <div className="mb-1 rounded-lg overflow-hidden bg-muted aspect-video flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {m.type === "document" && (
          <div className="mb-1 flex items-center gap-2 bg-muted/60 rounded-lg p-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-xs">{m.metadata?.filename ?? "Documento"}</span>
          </div>
        )}
        {m.type === "audio" && (
          <div className="mb-1 flex items-center gap-2 bg-muted/60 rounded-lg p-2">
            <Mic className="h-4 w-4 text-primary" />
            <span className="text-xs">Audio</span>
          </div>
        )}
        {m.type === "location" && (
          <div className="mb-1 flex items-center gap-2 bg-muted/60 rounded-lg p-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-xs">Ubicación</span>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
        <div className={cn("text-[10px] mt-0.5 flex items-center gap-1", out ? "justify-end text-muted-foreground" : "text-muted-foreground")}>
          <span>{formatTime(m.sentAt)}</span>
          {out && (m.readAt ? <CheckCheck className="h-3 w-3 text-info" /> : <Check className="h-3 w-3" />)}
        </div>
      </div>
    </div>
  );
}

export function MessageList({ messages, loading }: { messages: MessageItem[]; loading?: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  if (loading) {
    return <MessageListSkeleton rows={6} />;
  }
  if (!messages.length) {
    return <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Sin mensajes todavía</div>;
  }

  // group by day
  const groups: { label: string; items: MessageItem[] }[] = [];
  for (const m of messages) {
    const label = dateLabel(m.sentAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(m);
    else groups.push({ label, items: [m] });
  }

  return (
    <ScrollArea className="flex-1 bg-gradient-soft">
      <div className="p-4 space-y-4">
        {groups.map((g, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-center">
              <span className="text-[10px] font-medium bg-card border border-border rounded-full px-2.5 py-0.5 text-muted-foreground">
                {g.label}
              </span>
            </div>
            {g.items.map((m) => (
              <MessageBubble key={m.id} m={m} />
            ))}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}
