import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Msg = { id: string; direction: string; body: string; sent_at: string };

export default function WhatsappSim() {
  const [channel, setChannel] = useState<{ phone_number_id: string; display_name?: string | null } | null>(null);
  const [name, setName] = useState("María Quispe");
  const [from, setFrom] = useState("51987654321");
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("whatsapp_channels").select("phone_number_id, display_name" as any)
      .like("phone_number_id", "SIM%").limit(1).maybeSingle()
      .then(({ data }) => setChannel((data as any) ?? null));
  }, []);

  async function loadMessages() {
    const digits = from.replace(/\D/g, "");
    if (digits.length < 8) return;
    const { data: contacts } = await supabase.from("contacts").select("id")
      .ilike("phone", `%${digits.slice(-9)}%`).limit(5);
    const ids = (contacts ?? []).map((c: any) => c.id);
    if (!ids.length) { setMsgs([]); return; }
    const { data: convs } = await supabase.from("conversations").select("id").in("contact_id", ids);
    const cids = (convs ?? []).map((c: any) => c.id);
    if (!cids.length) { setMsgs([]); return; }
    const { data } = await supabase.from("messages").select("id, direction, body, sent_at")
      .in("conversation_id", cids).eq("is_internal_note", false)
      .order("sent_at", { ascending: true }).limit(200);
    setMsgs((data as any) ?? []);
  }

  useEffect(() => {
    loadMessages();
    const t = setInterval(loadMessages, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  async function send() {
    if (!channel) { toast.error("No hay un canal de demostración en esta empresa"); return; }
    if (!text.trim()) return;
    setSending(true);
    const digits = from.replace(/\D/g, "");
    const payload = {
      object: "whatsapp_business_account",
      entry: [{ id: "SIM", changes: [{ field: "messages", value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: channel.phone_number_id, phone_number_id: channel.phone_number_id },
        contacts: [{ profile: { name }, wa_id: digits }],
        messages: [{ from: digits, id: `sim.${Date.now()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text.trim() } }],
      } }] }],
    };
    const { error } = await supabase.functions.invoke("whatsapp-webhook", { body: payload });
    setSending(false);
    if (error) { toast.error("No se pudo enviar el mensaje"); return; }
    setText("");
    setTimeout(loadMessages, 800);
  }

  return (
    <div className="max-w-5xl mx-auto p-6 grid gap-8 md:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Smartphone className="h-7 w-7" /> Celular del cliente (demo)</h1>
        <p className="text-muted-foreground">
          Escribe aquí como si fueras un aspirante. El mensaje llega a la bandeja de WhatsApp de Walix y las respuestas del asesor aparecen en este celular.
        </p>
        {!channel && <p className="text-destructive text-sm">Esta empresa no tiene un canal de demostración.</p>}
        <div className="space-y-1.5"><Label>Nombre del cliente</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Número del cliente</Label><Input value={from} onChange={e => setFrom(e.target.value)} /></div>
        <p className="text-sm text-muted-foreground">Tip: abre WhatsApp de Walix en otra pestaña para mostrar ambos lados al mismo tiempo.</p>
      </div>

      <div className="rounded-[2.5rem] border-8 border-foreground/80 bg-card shadow-xl overflow-hidden flex flex-col h-[640px]">
        <div className="bg-primary text-primary-foreground px-4 py-3">
          <div className="font-semibold">{channel?.display_name ?? "Admisiones"}</div>
          <div className="text-xs opacity-80">en línea</div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted">
          {msgs.map(m => (
            <div key={m.id} className={`flex ${m.direction === "inbound" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm whitespace-pre-wrap ${m.direction === "inbound" ? "bg-primary/15" : "bg-background"}`}>
                {m.body}
                <div className="text-[10px] text-muted-foreground text-right mt-1">
                  {new Date(m.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="p-2 flex gap-2 border-t bg-card">
          <Input placeholder="Escribe un mensaje" value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") send(); }} />
          <Button size="icon" onClick={send} disabled={sending || !text.trim()}><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
