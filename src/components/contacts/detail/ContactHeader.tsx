import { MessageCircle, Edit, MoreHorizontal, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { statusBadgeClass } from "@/lib/contacts/badges";
import { useContactTags, getTagMetaFromList } from "@/lib/queries/contactTags";
import type { ContactRow } from "@/lib/queries/contacts";
import { cn } from "@/lib/utils";

interface Props {
  contact: ContactRow;
  onWhatsApp: () => void;
}

export function ContactHeader({ contact, onWhatsApp }: Props) {
  const { data: tagList } = useContactTags();
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-4 shadow-card">
        <Avatar className="h-14 w-14 shrink-0">
          <AvatarFallback style={{ background: contact.avatarColor, color: "white" }} className="text-lg font-semibold">
            {contact.name[0]}{contact.lastName?.[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight truncate">{contact.name} {contact.lastName}</h1>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border", statusBadgeClass[contact.status])}>
              {contact.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{contact.position} · {contact.company}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={onWhatsApp} size="sm" className="bg-success hover:bg-success/90 text-success-foreground">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
          <Button variant="outline" size="sm" className="hidden md:inline-flex"><Edit className="h-4 w-4" /> Editar</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Reasignar vendedor</DropdownMenuItem>
              <DropdownMenuItem>Cambiar status</DropdownMenuItem>
              <DropdownMenuItem>Agregar a campaña</DropdownMenuItem>
              <DropdownMenuItem className="text-danger">Eliminar contacto</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-1 flex-wrap">
        {contact.tags.map(t => {
          const meta = getTagMetaFromList(tagList, t);
          return (
            <span key={t} className={cn("text-[11px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1", meta.className)}>
              <span>{meta.icon}</span>{t}
            </span>
          );
        })}
        <button className="text-[11px] px-2 py-0.5 rounded-full bg-transparent text-muted-foreground border border-dashed border-border hover:bg-muted/50 inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> etiqueta
        </button>
      </div>
    </div>
  );
}