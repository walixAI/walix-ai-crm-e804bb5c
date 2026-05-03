import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, FileText, PanelLeft, KanbanSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { relativeTime } from "@/lib/format/relativeTime";
import {
  useContact, useContactDeals, useContactActivity,
  useContactConversations, useContactStats,
} from "@/lib/queries/contacts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContactHeader } from "@/components/contacts/detail/ContactHeader";
import { ContactStatsBar } from "@/components/contacts/detail/ContactStatsBar";
import { InfoSidePanel } from "@/components/contacts/detail/InfoSidePanel";
import { DealsSidePanel } from "@/components/contacts/detail/DealsSidePanel";
import { SummaryTab } from "@/components/contacts/detail/SummaryTab";
import { AiFloatingPanel } from "@/components/contacts/detail/AiFloatingPanel";
import { ContactDetailSkeleton } from "@/components/walix/Skeletons";

export default function ContactDetail() {
  const { id } = useParams();
  const { data: contact, isLoading } = useContact(id);
  const { data: deals = [] } = useContactDeals(id);
  const { data: activity = [] } = useContactActivity(id);
  const { data: convs = [] } = useContactConversations(id);
  const stats = useContactStats(id, contact?.lastActivity, contact?.createdAt);

  if (isLoading) {
    return <div className="p-6"><ContactDetailSkeleton /></div>;
  }
  if (!contact) {
    return (
      <div className="p-8 space-y-3">
        <Link to="/contacts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Contactos
        </Link>
        <p className="text-sm">Contacto no encontrado.</p>
      </div>
    );
  }

  const openWA = () => window.open(`https://wa.me/${contact.phone.replace(/[^0-9]/g, "")}`, "_blank");

  return (
    <div className="space-y-4 max-w-[1600px]">
      <Link to="/contacts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Contactos
      </Link>

      <ContactHeader contact={contact} onWhatsApp={openWA} />
      <ContactStatsBar stats={{
        pipelineValue: stats.pipelineValue,
        probability: stats.probability,
        lastContactRelative: stats.lastContactAt ? relativeTime(stats.lastContactAt) : "—",
        customerSince: stats.customerSince,
      }} />

      {/* Mobile: paneles como sheets */}
      <div className="flex gap-2 lg:hidden">
        <Sheet>
          <SheetTrigger asChild><Button variant="outline" size="sm" className="flex-1"><PanelLeft className="h-4 w-4" /> Info</Button></SheetTrigger>
          <SheetContent side="left" className="w-[300px]"><div className="mt-6"><InfoSidePanel contact={contact} /></div></SheetContent>
        </Sheet>
        <Sheet>
          <SheetTrigger asChild><Button variant="outline" size="sm" className="flex-1"><KanbanSquare className="h-4 w-4" /> Deals</Button></SheetTrigger>
          <SheetContent side="right" className="w-[300px]"><div className="mt-6"><DealsSidePanel contactId={contact.id} /></div></SheetContent>
        </Sheet>
      </div>

      {/* Layout 3 columnas (desktop) */}
      <div className="grid gap-4 lg:grid-cols-[256px_1fr_256px]">
        <aside className="hidden lg:block">
          <div className="sticky top-4">
            <InfoSidePanel contact={contact} />
          </div>
        </aside>

        <div className="min-w-0">
          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">Resumen</TabsTrigger>
              <TabsTrigger value="conversations">Conversaciones</TabsTrigger>
              <TabsTrigger value="oportunidades">Deals <span className="ml-1 text-[10px] bg-muted px-1.5 rounded">{deals.length}</span></TabsTrigger>
              <TabsTrigger value="activity">Actividad</TabsTrigger>
              <TabsTrigger value="notes">Notas</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-4">
              <SummaryTab contact={contact} onWhatsApp={openWA} activity={activity} />
            </TabsContent>

            <TabsContent value="conversations" className="mt-4">
              <div className="rounded-xl border border-border bg-card divide-y divide-border shadow-card">
                {convs.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="h-10 w-10 rounded-full bg-success/10 grid place-items-center"><MessageCircle className="h-5 w-5 text-success" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{c.preview}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{relativeTime(c.lastAt)}</div>
                    </div>
                    {c.unread > 0 && <span className="h-5 min-w-5 px-1.5 rounded-full bg-success text-success-foreground text-[10px] font-bold grid place-items-center">{c.unread}</span>}
                  </div>
                ))}
                {convs.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">Sin conversaciones todavía.</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="oportunidades" className="mt-4">
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
                {deals.length === 0 && (
                  <div className="md:col-span-2 rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                    Sin deals para este contacto.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <div className="rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="relative">
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
                  {activity.map(a => (
                    <div key={a.id} className="relative flex gap-4 pb-5 last:pb-0">
                      <div className="relative z-10 h-9 w-9 rounded-full bg-muted grid place-items-center shrink-0">
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="text-sm">{a.description}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px] bg-muted">{a.agentInitials}</AvatarFallback></Avatar>
                          <span>{a.agent}</span><span>·</span><span>{relativeTime(a.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activity.length === 0 && (
                    <div className="text-sm text-muted-foreground italic">Aún no hay actividad registrada.</div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-card">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Aún no hay notas para este contacto.</p>
                <Button variant="outline" size="sm" className="mt-3">Agregar nota</Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-4">
            <DealsSidePanel contactId={contact.id} />
          </div>
        </aside>
      </div>

      <AiFloatingPanel contact={contact} onWhatsApp={openWA} />
    </div>
  );
}