import { Bell, CheckCheck, Sparkles, AlertTriangle, Building2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
  type NotificationRow,
  type NotificationCategory,
} from "@/lib/queries/notifications";
import { useRespondLifecycleProposal } from "@/lib/queries/contacts";
import { useTenant } from "@/lib/queries/tenant";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const CATEGORY_META: Record<NotificationCategory, { label: string; icon: any }> = {
  operational: { label: "Para ti", icon: Inbox },
  ai: { label: "IA & Insights", icon: Sparkles },
  system: { label: "Sistema", icon: Building2 },
};

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-danger",
};

function LifecycleActions({ n, onDone }: { n: NotificationRow; onDone: () => void }) {
  const respond = useRespondLifecycleProposal();
  const { data: tenant } = useTenant();
  const graceDays = tenant?.lifecycleGraceDays ?? 60;
  const contactId = n.data?.contact_id as string | undefined;
  const toStatus = n.data?.to_status as any;
  if (!contactId) return null;

  const answer = (accept: boolean) =>
    respond.mutate(
      { contactId, accept, toStatus, graceDays },
      {
        onSuccess: () => {
          toast.success(
            accept ? "Ciclo de vida actualizado" : `Se mantiene igual. Preguntaremos en ${graceDays} días.`,
          );
          onDone();
        },
      },
    );

  return (
    <div className="flex items-center gap-2 mt-2">
      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={respond.isPending}
        onClick={(e) => { e.stopPropagation(); answer(false); }}>
        No, mantener
      </Button>
      <Button size="sm" className="h-7 text-xs" disabled={respond.isPending}
        onClick={(e) => { e.stopPropagation(); answer(true); }}>
        Sí, cambiar
      </Button>
    </div>
  );
}

export function NotificationsBell() {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotifications();
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const grouped = (["operational", "ai", "system"] as NotificationCategory[]).map((cat) => ({
    cat,
    items: notifications.filter((n) => n.category === cat),
  })).filter((g) => g.items.length > 0);

  const handleClick = (n: NotificationRow) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unread > 0 && (
            <span
              role="status"
              aria-live="polite"
              className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-[10px] font-bold text-danger-foreground flex items-center justify-center animate-pulse-glow"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <div className="text-sm font-semibold">Notificaciones</div>
            <div className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} sin leer` : "Todo al día"}
            </div>
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Marcar todo
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[420px]">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Cargando...</div>
          ) : grouped.length === 0 ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <div className="text-sm font-medium">Sin notificaciones</div>
              <div className="text-xs text-muted-foreground mt-1">
                Te avisaremos cuando algo importante suceda
              </div>
            </div>
          ) : (
            grouped.map(({ cat, items }) => {
              const Meta = CATEGORY_META[cat];
              const Icon = Meta.icon;
              return (
                <div key={cat} className="py-1">
                  <div className="px-4 py-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    {Meta.label}
                  </div>
                  {items.map((n) => (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleClick(n)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 hover:bg-muted/60 transition-colors flex gap-3 items-start border-l-2",
                        n.read_at ? "border-transparent opacity-70" : "border-primary"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 rounded-full shrink-0",
                          SEVERITY_DOT[n.severity] ?? "bg-muted-foreground"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{n.title}</div>
                        {n.body && (
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {n.body}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </div>
                        {n.type === "lifecycle_change_request" && (
                          <LifecycleActions n={n} onDone={() => !n.read_at && markRead.mutate(n.id)} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
