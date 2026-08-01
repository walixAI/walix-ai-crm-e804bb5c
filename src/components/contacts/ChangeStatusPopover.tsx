import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ALL_CONTACT_LIFECYCLES, lifecycleLabel, statusBadgeClass, type ContactLifecycle } from "@/lib/contacts/badges";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  trigger: React.ReactNode;
  current?: ContactLifecycle;
  onSelect: (status: ContactLifecycle) => void;
  align?: "start" | "center" | "end";
}

export function ChangeStatusPopover({ trigger, current, onSelect, align = "end" }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-56 p-1">
        <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Cambiar ciclo de vida
        </div>
        <div className="space-y-0.5">
          {ALL_CONTACT_LIFECYCLES.map((s) => (
            <button
              key={s}
              onClick={() => onSelect(s)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted text-left"
            >
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border", statusBadgeClass[s])}>
                {lifecycleLabel[s]}
              </span>
              <span className="flex-1" />
              {current === s && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
