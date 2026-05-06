import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, PanelLeft, KanbanSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  useContact,
  useContactConversations,
} from "@/lib/queries/contacts";
import { relativeTime } from "@/lib/format/relativeTime";
import { ContactHeader } from "@/components/contacts/detail/ContactHeader";
import { ContactInfoCard } from "@/components/contacts/detail/ContactInfoCard";
import { CompanyCard } from "@/components/contacts/detail/CompanyCard";
import { DealsSidePanel } from "@/components/contacts/detail/DealsSidePanel";
import { SummaryTab } from "@/components/contacts/detail/SummaryTab";
import { AiFloatingPanel } from "@/components/contacts/detail/AiFloatingPanel";
import { ContactDetailSkeleton } from "@/components/walix/Skeletons";
import { ActivitiesTab } from "@/components/contacts/detail/ActivitiesTab";
import { useContactActivity } from "@/lib/queries/contacts";

export default function ContactDetail() {
  const { id } = useParams();
  const { data: contact, isLoading } = useContact(id);
  const { data: activity = [] } = useContactActivity(id);
  const { data: convs = [] } = useContactConversations(id);

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

      {/* Mobile: paneles como sheets */}
      <div className="flex gap-2 lg:hidden">
        <Sheet>
          <SheetTrigger asChild><Button variant="outline" size="sm" className="flex-1"><PanelLeft className="h-4 w-4" /> Info</Button></SheetTrigger>
          <SheetContent side="left" className="w-[300px]"><div className="mt-6 space-y-2"><ContactInfoCard contact={contact} /><CompanyCard contact={contact} /></div></SheetContent>
        </Sheet>
        <Sheet>
          <SheetTrigger asChild><Button variant="outline" size="sm" className="flex-1"><KanbanSquare className="h-4 w-4" /> Deals</Button></SheetTrigger>
          <SheetContent side="right" className="w-[300px]"><div className="mt-6"><DealsSidePanel contactId={contact.id} /></div></SheetContent>
        </Sheet>
      </div>

      {/* Layout 3 columnas (desktop) */}
      <div className="grid gap-4 lg:grid-cols-[256px_1fr_256px]">
        <aside className="hidden lg:block">
          <div className="sticky top-4 space-y-2">
            <ContactInfoCard contact={contact} />
            <CompanyCard contact={contact} />
          </div>
        </aside>

        <div className="min-w-0">
          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">Resumen</TabsTrigger>
              <TabsTrigger value="conversations">
                Conversaciones {convs.length > 0 && <span className="ml-1 text-[10px] bg-muted px-1.5 rounded">{convs.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="activities">Actividades</TabsTrigger>
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

            <TabsContent value="activities" className="mt-4">
              <ActivitiesTab contactId={contact.id} />
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