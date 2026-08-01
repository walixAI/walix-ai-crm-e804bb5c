import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Edit, MoreHorizontal, Plus, Phone, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { statusBadgeClass } from "@/lib/contacts/badges";
import { useContactTags, getTagMetaFromList } from "@/lib/queries/contactTags";
import { useUpdateContact, useDeleteContact, useContactStats, type ContactRow } from "@/lib/queries/contacts";
import { cn } from "@/lib/utils";
import { ContactFormDialog } from "@/components/contacts/ContactFormDialog";
import { ReassignPopover } from "@/components/contacts/ReassignPopover";
import { ChangeStatusPopover } from "@/components/contacts/ChangeStatusPopover";
import { TagsPopover } from "@/components/contacts/TagsPopover";
import { ConfirmDialog } from "@/components/walix/ConfirmDialog";
import { relativeTime } from "@/lib/format/relativeTime";
import { toast } from "sonner";

interface Props {
  contact: ContactRow;
  onWhatsApp: () => void;
}

export function ContactHeader({ contact, onWhatsApp }: Props) {
  const { data: tagList } = useContactTags();
  const update = useUpdateContact();
  const remove = useDeleteContact();
  const stats = useContactStats(contact.id, contact.lastActivity, contact.createdAt);
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const callPhone = () => window.open(`tel:${contact.phone.replace(/[^0-9+]/g, "")}`);
  const reassign = (uid: string | null) =>
    update.mutate({ id: contact.id, patch: { owner_id: uid } }, { onSuccess: () => toast.success("Reasignado") });
  const changeStatus = (s: any) =>
    update.mutate({ id: contact.id, patch: { status: s } }, { onSuccess: () => toast.success(`Status: ${s}`) });
  const toggleTag = (t: string, checked: boolean) => {
    const tags = checked
      ? Array.from(new Set([...(contact.tags ?? []), t]))
      : (contact.tags ?? []).filter((x) => x !== t);
    update.mutate({ id: contact.id, patch: { tags } });
  };
  const removeTag = (t: string) => toggleTag(t, false);

  const kpis = [
    { label: "Pipeline", value: `$${stats.pipelineValue.toLocaleString("es-MX")}` },
    { label: "Probabilidad", value: `${stats.probability}%`, accent: "text-primary" },
    { label: "Última conv.", value: stats.lastContactAt ? relativeTime(stats.lastContactAt) : "—" },
    { label: "Cliente desde", value: stats.customerSince },
  ];

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-5 shadow-card">
        <Avatar className="h-14 w-14 shrink-0">
          <AvatarFallback style={{ background: contact.avatarColor, color: "white" }} className="text-lg font-semibold">
            {contact.name[0]}{contact.lastName?.[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 max-w-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight truncate">{contact.name} {contact.lastName}</h1>
            <ChangeStatusPopover
              current={contact.status}
              onSelect={changeStatus}
              align="start"
              trigger={
                <button className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border hover:opacity-80", statusBadgeClass[contact.status])}>
                  {lifecycleLabel[contact.status]}
                </button>
              }
            />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {contact.position ?? "—"}{contact.company ? ` · ${contact.company}` : ""}
          </p>
        </div>

        {/* KPIs centro */}
        <div className="hidden md:flex items-center gap-5 flex-1 justify-center px-4 border-l border-r border-border min-w-0">
          {kpis.map((k) => (
            <div key={k.label} className="text-center min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{k.label}</div>
              <div className={cn("font-bold text-base truncate", k.accent ?? "text-foreground")}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={onWhatsApp} size="sm" className="bg-success hover:bg-success/90 text-success-foreground">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
          <Button variant="outline" size="icon" onClick={callPhone} title="Llamar"><Phone className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={() => setEditOpen(true)}>
            <Edit className="h-4 w-4" /> Editar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <ReassignPopover
                currentOwnerId={contact.ownerId}
                onSelect={reassign}
                trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Reasignar vendedor</DropdownMenuItem>}
              />
              <ChangeStatusPopover
                current={contact.status}
                onSelect={changeStatus}
                trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Cambiar status</DropdownMenuItem>}
              />
              <DropdownMenuItem onSelect={() => toast.info("Próximamente: añadir a campaña")}>
                Agregar a campaña
              </DropdownMenuItem>
              <DropdownMenuItem className="text-danger" onSelect={() => setConfirmDelete(true)}>
                Eliminar contacto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-1 flex-wrap">
        {contact.tags.map(t => {
          const meta = getTagMetaFromList(tagList, t);
          return (
            <span key={t} className={cn("group text-[11px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1", meta.className)}>
              <span>{meta.icon}</span>{t}
              <button onClick={() => removeTag(t)} className="opacity-0 group-hover:opacity-100 hover:bg-black/10 rounded-full">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          );
        })}
        <TagsPopover
          align="start"
          current={contact.tags}
          onToggle={toggleTag}
          trigger={
            <button className="text-[11px] px-2 py-0.5 rounded-full bg-transparent text-muted-foreground border border-dashed border-border hover:bg-muted/50 inline-flex items-center gap-1">
              <Plus className="h-3 w-3" /> etiqueta
            </button>
          }
        />
      </div>

      <ContactFormDialog open={editOpen} onOpenChange={setEditOpen} contact={contact} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar este contacto?"
        description="Se eliminarán también sus actividades, tareas y conversaciones asociadas."
        confirmLabel="Eliminar"
        loading={remove.isPending}
        onConfirm={() => remove.mutate(contact.id, {
          onSuccess: () => { toast.success("Contacto eliminado"); navigate("/contacts"); },
        })}
      />
    </div>
  );
}