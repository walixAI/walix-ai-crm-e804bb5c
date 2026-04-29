import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WBadge } from "@/components/walix/Badge";
import { Plus, Loader2, Mail, X } from "lucide-react";
import { useMembers, useInvitations, useToggleMemberActive, useRevokeInvitation } from "@/lib/queries/team";
import { useQuery } from "@tanstack/react-query";
import { fetchTenant } from "@/services/tenant";
import { usePlanLimit } from "@/lib/queries/planLimits";
import { ROLE_LABEL } from "@/constants/permissions";
import { InviteUserDialog } from "./InviteUserDialog";
import { primaryRole } from "@/lib/permissions";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function TeamTab({ tenantId }: { tenantId: string }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data: members = [], isLoading } = useMembers(tenantId);
  const { data: invites = [] } = useInvitations(tenantId);
  const { data: tenant } = useQuery({ queryKey: ["tenant", tenantId], queryFn: () => fetchTenant(tenantId) });
  const limit = usePlanLimit(tenant?.plan);
  const toggle = useToggleMemberActive(tenantId);
  const revoke = useRevokeInvitation(tenantId);

  const activeCount = members.filter((m) => m.is_active).length;
  const max = limit?.max_users ?? 0;
  const reached = max > 0 && activeCount >= max;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Miembros del equipo</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {limit ? <>Plan <span className="font-medium capitalize">{tenant?.plan}</span> · {activeCount} de {max} usuarios activos</> : "Cargando límites..."}
            </p>
          </div>
          <Button onClick={() => setInviteOpen(true)} disabled={reached}>
            <Plus className="h-4 w-4 mr-2" />
            Invitar miembro
          </Button>
        </div>

        {reached && (
          <div className="mt-4 rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm text-warning">
            Llegaste al límite de usuarios de tu plan. Desactiva miembros o cambia de plan para invitar más.
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Equipo activo
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" /> Cargando equipo...
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Aún no hay miembros.</div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => {
              const role = primaryRole(m.roles);
              return (
                <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                  <Avatar className="h-10 w-10">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                    <AvatarFallback>{(m.full_name ?? m.email ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{m.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.email ?? ""}</div>
                  </div>
                  <div className="hidden md:block min-w-[140px]">
                    <WBadge variant={role === "tenant_admin" ? "brand" : role === "sales_manager" ? "info" : "neutral"}>
                      {role ? ROLE_LABEL[role] : "Sin rol"}
                    </WBadge>
                  </div>
                  <div className="hidden lg:block text-xs text-muted-foreground min-w-[120px]">
                    {m.last_seen_at ? `Hace ${formatDistanceToNow(new Date(m.last_seen_at), { locale: es })}` : "Nunca"}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {m.is_active ? "Activo" : "Pausado"}
                    </span>
                    <Switch
                      checked={m.is_active}
                      onCheckedChange={(v) => toggle.mutate({ userId: m.id, active: v })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {invites.filter((i) => i.status === "pending").length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Invitaciones pendientes
          </div>
          <div className="divide-y divide-border">
            {invites.filter((i) => i.status === "pending").map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-3">
                <div className="h-9 w-9 rounded-full bg-muted grid place-items-center">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {ROLE_LABEL[inv.role]} · expira {formatDistanceToNow(new Date(inv.expires_at), { locale: es, addSuffix: true })}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(inv.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <InviteUserDialog tenantId={tenantId} open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}