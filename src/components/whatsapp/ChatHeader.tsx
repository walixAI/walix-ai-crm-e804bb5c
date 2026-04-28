import { Link } from "react-router-dom";
import { ChevronRight, MoreVertical, User, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { sellers } from "@/mock/contacts";
import type { ConversationItem, ConversationStatus } from "@/lib/queries/whatsapp";

const STATUSES: ConversationStatus[] = ["Nuevo", "En atención", "Esperando", "Resuelto"];

interface Props {
  conv: ConversationItem;
  onChangeStatus: (s: ConversationStatus) => void;
  onChangeAssignee: (id: string | null) => void;
  onTogglePanel: () => void;
  panelOpen: boolean;
}

export function ChatHeader({ conv, onChangeStatus, onChangeAssignee, onTogglePanel, panelOpen }: Props) {
  return (
    <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
      <Link to={`/contacts/${conv.contactId}`} className="flex items-center gap-3 group min-w-0">
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
          style={{ background: conv.avatarColor }}
        >
          {conv.initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate group-hover:text-primary transition">{conv.contactName}</p>
          <p className="text-xs text-muted-foreground truncate">{conv.contactPhone}</p>
        </div>
      </Link>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Status */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              {conv.status}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Estado</DropdownMenuLabel>
            {STATUSES.map((s) => (
              <DropdownMenuItem key={s} onClick={() => onChangeStatus(s)}>
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Assignee */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <User className="h-3 w-3" />
              {conv.assigneeId ? conv.assigneeInitials : "Sin asignar"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Vendedor</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onChangeAssignee(null)}>Sin asignar</DropdownMenuItem>
            <DropdownMenuSeparator />
            {sellers.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => onChangeAssignee(s.id)}>
                <span className="h-5 w-5 rounded-full text-[10px] text-white flex items-center justify-center mr-2" style={{ background: s.color }}>
                  {s.initials}
                </span>
                {s.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
          <Link2 className="h-3 w-3" />
          <span className="hidden lg:inline">Vincular Deal</span>
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onTogglePanel} title={panelOpen ? "Ocultar panel" : "Mostrar panel"}>
          <ChevronRight className={`h-4 w-4 transition ${panelOpen ? "rotate-180" : ""}`} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Marcar no leído</DropdownMenuItem>
            <DropdownMenuItem>Silenciar</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Archivar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
