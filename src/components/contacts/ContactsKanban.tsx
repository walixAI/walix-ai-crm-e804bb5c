import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ALL_LEAD_STATUSES, statusBadgeClass, type LeadStatus } from "@/lib/contacts/badges";
import { relativeTime } from "@/lib/format/relativeTime";
import { useUpdateContact, type ContactRow } from "@/lib/queries/contacts";
import { cn } from "@/lib/utils";
import { useEntityUrgency } from "@/hooks/useEntityUrgency";

interface Props {
  contacts: ContactRow[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onWhatsApp: (phone: string) => void;
}

export function ContactsKanban({ contacts, selected, onToggleSelect, onWhatsApp }: Props) {
  const update = useUpdateContact();
  const [active, setActive] = useState<ContactRow | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragStart(e: DragStartEvent) {
    const c = contacts.find((x) => x.id === e.active.id);
    if (c) setActive(c);
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const id = e.active.id as string;
    const target = e.over?.id as LeadStatus | undefined;
    if (!target) return;
    const c = contacts.find((x) => x.id === id);
    if (!c || c.status === target) return;
    update.mutate(
      { id, patch: { status: target } },
      {
        onSuccess: () => toast.success(`${c.name} → ${target}`),
        onError: () => toast.error("No se pudo mover el contacto"),
      },
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {ALL_LEAD_STATUSES.map((status) => {
          const items = contacts.filter((c) => c.status === status);
          return (
            <KanbanColumn
              key={status}
              status={status}
              items={items}
              selected={selected}
              onToggleSelect={onToggleSelect}
              onWhatsApp={onWhatsApp}
            />
          );
        })}
      </div>
      <DragOverlay>
        {active && (
          <div className="w-[260px] opacity-90">
            <ContactCard contact={active} selected={false} onToggleSelect={() => {}} onWhatsApp={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status, items, selected, onToggleSelect, onWhatsApp,
}: {
  status: LeadStatus;
  items: ContactRow[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onWhatsApp: (phone: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="w-[280px] shrink-0 flex flex-col">
      <div className="px-2 py-2 mb-2 flex items-center justify-between">
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border", statusBadgeClass[status])}>
          {status}
        </span>
        <span className="text-xs font-semibold text-muted-foreground">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[200px] rounded-xl border border-border bg-muted/20 p-2 space-y-2 transition-colors",
          isOver && "border-primary bg-primary/5",
        )}
      >
        {items.map((c) => (
          <ContactCard
            key={c.id}
            contact={c}
            selected={selected.has(c.id)}
            onToggleSelect={() => onToggleSelect(c.id)}
            onWhatsApp={() => onWhatsApp(c.phone)}
          />
        ))}
        {items.length === 0 && (
          <div className="text-xs text-muted-foreground italic text-center py-6">Sin contactos</div>
        )}
      </div>
    </div>
  );
}

function ContactCard({
  contact, selected, onToggleSelect, onWhatsApp,
}: {
  contact: ContactRow;
  selected: boolean;
  onToggleSelect: () => void;
  onWhatsApp: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: contact.id });
  const { urgencyScore } = useEntityUrgency("contact", contact.id);
  const dotColor =
    urgencyScore === null
      ? null
      : urgencyScore > 70
        ? "bg-destructive"
        : urgencyScore >= 30
          ? "bg-warning"
          : "bg-success";
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "group rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <div className="flex items-start gap-2">
        <div onPointerDown={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
        </div>
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback style={{ background: contact.avatarColor, color: "white" }} className="text-xs font-semibold">
            {contact.name[0]}{contact.lastName?.[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <Link
            to={`/contacts/${contact.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            className="font-medium text-sm hover:text-primary truncate block"
          >
            {contact.name} {contact.lastName}
          </Link>
          {contact.company && (
            <div className="text-xs text-muted-foreground truncate">{contact.company}</div>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onWhatsApp}
          className="inline-flex items-center gap-1 hover:text-success"
        >
          <MessageCircle className="h-3 w-3" />
          <span className="font-mono">{contact.phone}</span>
        </button>
        <span className="inline-flex items-center gap-1.5">
          {dotColor && (
            <span
              className={cn("h-1.5 w-1.5 rounded-full", dotColor)}
              title={`Urgencia ${urgencyScore}/100`}
            />
          )}
          {relativeTime(contact.lastActivity)}
        </span>
      </div>
      {contact.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {contact.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}