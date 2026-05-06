import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTenantUsers } from "@/lib/queries/tenantUsers";
import { Check, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  trigger: React.ReactNode;
  currentOwnerId?: string | null;
  onSelect: (ownerId: string | null) => void;
  align?: "start" | "center" | "end";
}

export function ReassignPopover({ trigger, currentOwnerId, onSelect, align = "end" }: Props) {
  const { data: users = [] } = useTenantUsers();
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-1">
        <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <UserCheck className="h-3 w-3" /> Reasignar vendedor
        </div>
        <div className="max-h-72 overflow-y-auto">
          <button
            onClick={() => onSelect(null)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted text-left"
          >
            <span className="h-6 w-6 rounded-full bg-muted grid place-items-center text-[10px]">—</span>
            <span className="flex-1">Sin asignar</span>
            {!currentOwnerId && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => onSelect(u.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted text-left",
                currentOwnerId === u.id && "bg-muted/50",
              )}
            >
              <span
                className="h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold text-white"
                style={{ background: u.color }}
              >
                {u.initials}
              </span>
              <span className="flex-1 truncate">{u.name}</span>
              {currentOwnerId === u.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
          {users.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground italic text-center">
              Sin miembros activos
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}