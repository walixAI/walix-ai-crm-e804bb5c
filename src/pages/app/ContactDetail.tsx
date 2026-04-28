import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, Edit, MoreHorizontal, Sparkles, Send, ChevronRight, MessageSquare, FileText, StickyNote, KanbanSquare, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { contacts, statusBadgeClass, relativeTime, getContactActivity, getContactDeals, getContactConversations, sellers } from "@/mock/contacts";
import { cn } from "@/lib/utils";

const activityIcon = {
  wa_sent: { Icon: MessageCircle, color: "text-success", bg: "bg-success/10" },
  wa_received: { Icon: MessageCircle, color: "text-info", bg: "bg-info/10" },
  note: { Icon: StickyNote, color: "text-info", bg: "bg-info/10" },
  deal: { Icon: KanbanSquare, color: "text-primary", bg: "bg-primary/10" },
  task: { Icon: CheckCircle2, color: "text-muted-foreground", bg: "bg-muted" },
};

export default function ContactDetail() {
  const { id } = useParams();
  const contact = contacts.find(c => c.id === id) ?? contacts[0];
  const [editing, setEditing] = useState<string | null>(null);
  const activity = getContactActivity(contact.id);
  const deals = getContactDeals(contact.id);
  const convs = getContactConversations(contact.id);

  const openWA = () => window.open(`https://wa.me/${contact.phone.replace(/[^0-9]/g, "")}`, "_blank");

  return (
    <div className="flex gap-6 max-w-[1600px]">
      <div className="flex-1 min-w-0 space-y-5">
        <Link to="/contacts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Contactos
        </Link>

        {/* Header */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-start gap-4 flex-wrap">
            <Avatar className="h-20 w-20"><AvatarFallback style={{ background: contact.avatarColor, color: "white" }} className="text-2xl font-semibold">{contact.name[0]}{contact.lastName?.[0]}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{contact.name} {contact.lastName}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{contact.position} · {contact.company}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border", statusBadgeClass[contact.status])}>{contact.status}</span>
                {contact.tags.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">#{t}</span>)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={openWA} className="bg-success hover:bg-success/90 text-success-foreground"><MessageCircle className="h-4 w-4" /> Abrir WhatsApp</Button>
              <Button variant="outline"><Edit className="h-4 w-4" /> Editar</Button>
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
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="activity">Actividad</TabsTrigger>
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="wa">Conversaciones WA</TabsTrigger>
            <TabsTrigger value="docs">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <div className="rounded-xl border border-border bg-card p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {[
                ["Nombre", `${contact.name} ${contact.lastName ?? ""}`],
                ["Teléfono", contact.phone],
                ["Email", contact.email ?? "—"],
                ["Empresa", contact.company ?? "—"],
                ["Cargo", contact.position ?? "—"],
                ["Status", contact.status],
                ["Fuente", contact.source],
                ["Vendedor asignado", contact.ownerName],
                ["Etiquetas", contact.tags.map(t => `#${t}`).join(" ")],
                ["Fecha de creación", new Date(contact.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })],
              ].map(([label, value]) => (
                <div key={label} className="group">
                  <div className="text-xs text-muted-foreground font-medium">{label}</div>
                  <button onClick={() => setEditing(label)} className="mt-0.5 text-sm w-full text-left py-1 px-2 -mx-2 rounded hover:bg-muted/50 transition-colors">
                    {editing === label ? <input autoFocus defaultValue={value} onBlur={() => setEditing(null)} className="w-full bg-transparent outline-none border-b border-primary" /> : <span>{value}</span>}
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="relative">
                <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
                {activity.map(a => {
                  const { Icon, color, bg } = activityIcon[a.type];
                  return (
                    <div key={a.id} className="relative flex gap-4 pb-5 last:pb-0">
                      <div className={cn("relative z-10 h-9 w-9 rounded-full grid place-items-center shrink-0", bg)}>
                        <Icon className={cn("h-4 w-4", color)} />
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="text-sm">{a.description}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px] bg-muted">{a.agentInitials}</AvatarFallback></Avatar>
                          <span>{a.agent}</span>
                          <span>·</span>
                          <span>{relativeTime(a.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deals" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deals.map(d => (
                <div key={d.id} className="rounded-xl border border-border bg-card p-4 shadow-card hover:shadow-card-hover transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold">{d.name}</h4>
                      <div className="text-2xl font-bold text-gradient-brand mt-1">${d.amount.toLocaleString("es-MX")}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-medium">{d.stage}</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Probabilidad de cierre</span>
                      <span className="font-semibold">{d.probability}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-brand transition-all" style={{ width: `${d.probability}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="wa" className="mt-4">
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {convs.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className="h-10 w-10 rounded-full bg-success/10 grid place-items-center"><MessageCircle className="h-5 w-5 text-success" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{c.preview}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.time}</div>
                  </div>
                  {c.unread > 0 && <span className="h-5 min-w-5 px-1.5 rounded-full bg-success text-success-foreground text-[10px] font-bold grid place-items-center">{c.unread}</span>}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="docs" className="mt-4">
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Aún no hay documentos compartidos con este contacto.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* AI side panel */}
      <aside className="hidden xl:block w-80 shrink-0">
        <div className="sticky top-4 rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-brand grid place-items-center"><Sparkles className="h-4 w-4 text-primary-foreground" /></div>
            <h3 className="font-semibold text-sm">Próximo paso sugerido</h3>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 p-3 text-sm leading-relaxed">
            Han pasado <strong>3 días</strong> desde tu último contacto con <strong>{contact.name}</strong>. Envíale el catálogo de productos que mencionó — mostró interés en la propuesta de <strong>$25,000</strong>.
          </div>
          <Button className="w-full bg-success hover:bg-success/90 text-success-foreground" size="sm" onClick={openWA}><Send className="h-3.5 w-3.5" /> Enviar por WhatsApp</Button>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Historial IA</h4>
            <div className="space-y-2">
              {[
                "Enviar recordatorio de cotización pendiente",
                "Confirmar interés en paquete premium",
                "Agendar llamada de seguimiento esta semana"
              ].map((s, i) => (
                <div key={i} className="text-xs p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors cursor-pointer flex items-center justify-between gap-2">
                  <span>{s}</span>
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
