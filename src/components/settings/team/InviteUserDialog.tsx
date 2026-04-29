import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCreateInvitation } from "@/lib/queries/team";
import { INVITABLE_ROLES, ROLE_DESCRIPTION, ROLE_LABEL } from "@/constants/permissions";
import type { Role } from "@/store/auth";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({ tenantId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("sales_rep");
  const create = useCreateInvitation(tenantId, user?.id);

  async function handleSubmit() {
    if (!email.includes("@")) {
      toast({ title: "Email inválido", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({ email, role });
      toast({
        title: "Invitación registrada",
        description: `Se notificará a ${email} cuando el envío de email esté activo.`,
      });
      setEmail("");
      setRole("sales_rep");
      onOpenChange(false);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Error";
      toast({ title: "No se pudo invitar", description: m, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invitar a un nuevo miembro</DialogTitle>
          <DialogDescription>
            Recibirá un email para crear su cuenta y unirse a tu instancia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email" type="email" placeholder="ejemplo@empresa.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Rol</Label>
            <div className="space-y-2">
              {INVITABLE_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "w-full text-left rounded-xl border p-3 transition-all",
                    role === r
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{ROLE_LABEL[r]}</span>
                    {role === r && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{ROLE_DESCRIPTION[r]}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}