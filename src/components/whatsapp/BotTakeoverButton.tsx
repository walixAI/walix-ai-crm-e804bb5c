import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Muestra si el bot (secuencia de campaña) sigue activo con este contacto y permite al asesor tomar el control. */
export function BotTakeoverButton({ contactId, conversationId }: { contactId: string; conversationId: string }) {
  const qc = useQueryClient();
  const key = ["bot-active", contactId];
  const { data: active = 0 } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("wa_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contactId)
        .eq("status", "active");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const take = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("wa_enrollments")
        .update({ status: "stopped", exit_reason: "el asesor tomó el control", next_send_at: null })
        .eq("contact_id", contactId)
        .eq("status", "active");
      if (error) throw error;
      if (user) {
        await supabase.from("conversations").update({ assignee_id: user.id, status: "En atención" }).eq("id", conversationId);
      }
    },
    onSuccess: () => {
      toast.success("Tomaste el control. El bot ya no le escribirá a este prospecto.");
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!active) return null;
  return (
    <Button
      size="sm"
      variant="default"
      className="h-8 text-xs gap-1.5"
      onClick={() => take.mutate()}
      disabled={take.isPending}
      title="El bot está dando seguimiento. Tócalo para atender tú al prospecto."
    >
      <Bot className="h-3 w-3" />
      <span className="hidden md:inline">Bot activo ·</span>
      <Hand className="h-3 w-3" />
      Tomar control
    </Button>
  );
}
