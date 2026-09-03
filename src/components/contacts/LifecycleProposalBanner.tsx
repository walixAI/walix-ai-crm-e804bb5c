import { UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { lifecycleLabel } from "@/lib/contacts/badges";
import { useRespondLifecycleProposal, type ContactRow } from "@/lib/queries/contacts";
import { useTenant } from "@/lib/queries/tenant";

export function LifecycleProposalBanner({ contact }: { contact: ContactRow }) {
  const { data: tenant } = useTenant();
  const respond = useRespondLifecycleProposal();
  const graceDays = tenant?.lifecycleGraceDays ?? 60;

  if (!contact.statusProposed) return null;

  const target = contact.statusProposed;

  const answer = (accept: boolean) =>
    respond.mutate(
      { contactId: contact.id, accept, toStatus: target, graceDays },
      {
        onSuccess: () =>
          toast.success(
            accept
              ? `Ciclo de vida actualizado a "${lifecycleLabel[target]}"`
              : `Se mantiene "${lifecycleLabel[contact.status]}". Volveremos a preguntar en ${graceDays} días.`,
          ),
      },
    );

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 flex flex-wrap items-center gap-3">
      <UserCog className="h-4 w-4 text-warning shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          Walix propone cambiar el ciclo de vida a “{lifecycleLabel[target]}”
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {contact.statusProposedReason ?? "Detectamos inactividad en este contacto."} Nada cambia
          hasta que lo confirmes.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="outline" disabled={respond.isPending} onClick={() => answer(false)}>
          No, mantener
        </Button>
        <Button size="sm" disabled={respond.isPending} onClick={() => answer(true)}>
          Sí, cambiar
        </Button>
      </div>
    </div>
  );
}
