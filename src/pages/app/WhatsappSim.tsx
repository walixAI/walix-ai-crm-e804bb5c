import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export default function WhatsappSim() {
  const [from, setFrom] = useState("5215555555555");
  const [text, setText] = useState("Hola, ¿me pueden dar cotización de un refri Sub-Zero de 36\"?");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string>("");

  async function send() {
    if (!phoneNumberId) { toast.error("Ingresa el phone_number_id del canal"); return; }
    setLoading(true);
    try {
      const payload = {
        object: "whatsapp_business_account",
        entry: [{
          id: "SIM",
          changes: [{
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: phoneNumberId, phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: "Simulador" }, wa_id: from }],
              messages: [{
                from,
                id: `sim.${Date.now()}`,
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body: text },
              }],
            },
          }],
        }],
      };
      const { data, error } = await supabase.functions.invoke("whatsapp-webhook", { body: payload });
      if (error) throw error;
      setLog(JSON.stringify(data ?? { ok: true }, null, 2));
      toast.success("Enviado al webhook");
    } catch (e: any) {
      setLog(String(e?.message ?? e));
      toast.error("Error", { description: String(e?.message ?? e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Simulador WhatsApp</h1>
        <p className="text-muted-foreground">Envía un mensaje inbound al webhook sin necesidad de Meta.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Nuevo mensaje simulado</CardTitle>
          <CardDescription>Simula que un cliente escribe a tu número.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>phone_number_id del canal (Meta)</Label>
            <Input value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} placeholder="Ej. 1234567890" />
          </div>
          <div className="space-y-1.5">
            <Label>Número que envía (wa_id)</Label>
            <Input value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mensaje</Label>
            <Textarea value={text} onChange={e => setText(e.target.value)} rows={4} />
          </div>
          <Button size="lg" onClick={send} disabled={loading}>
            {loading ? "Enviando…" : "Simular inbound"}
          </Button>
          {log && (
            <pre className="mt-4 text-xs bg-muted p-3 rounded overflow-auto max-h-64">{log}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}