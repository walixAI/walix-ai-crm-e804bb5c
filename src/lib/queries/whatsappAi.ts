import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WhatsappAiMode = "suggest_reply" | "summarize" | "custom_prompt";

export interface WhatsappAiInput {
  mode: WhatsappAiMode;
  conversationId: string;
  prompt?: string;
  contactName?: string;
  contactCompany?: string | null;
}

export function useWhatsappAi() {
  return useMutation({
    mutationFn: async (input: WhatsappAiInput): Promise<string> => {
      const { data, error } = await supabase.functions.invoke("whatsapp-ai", { body: input });
      if (error) {
        // surface 402/429 as friendly errors
        const msg = (error as any)?.context?.body
          ? (() => {
              try { return JSON.parse((error as any).context.body).error; } catch { return error.message; }
            })()
          : error.message;
        throw new Error(msg || "Error de IA");
      }
      if (!data?.text) throw new Error("Respuesta vacía");
      return data.text as string;
    },
  });
}