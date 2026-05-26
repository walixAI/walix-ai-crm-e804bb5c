import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { launchEmbeddedSignup } from "@/lib/whatsapp/metaEmbedded";
import type { ChannelKind } from "@/lib/queries/whatsappChannels";

interface Props {
  tenantId: string;
  kind: ChannelKind;
  isReconnect?: boolean;
  size?: "sm" | "default";
  variant?: "default" | "outline";
}

export function EmbeddedSignupButton({ tenantId, kind, isReconnect, size = "sm", variant = "default" }: Props) {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  async function handleClick() {
    setLoading(true);
    try {
      const result = await launchEmbeddedSignup();
      const { data, error } = await supabase.functions.invoke("whatsapp-embedded-signup", {
        body: { ...result, kind },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.details || data.error);
      toast.success("WhatsApp conectado", {
        description: data?.verified_name
          ? `${data.verified_name} · ${data.phone_number ?? ""}`
          : data?.phone_number ?? undefined,
      });
      qc.invalidateQueries({ queryKey: ["wa-channels", tenantId] });
    } catch (e) {
      toast.error("No se pudo conectar", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading} size={size} variant={variant}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <MessageCircle className="h-4 w-4 mr-2" />
      )}
      {isReconnect ? "Reconectar con Meta" : "Conectar con Meta"}
    </Button>
  );
}