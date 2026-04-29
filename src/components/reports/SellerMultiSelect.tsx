import { useState } from "react";
import { Users, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { sellers, type SellerId } from "@/mock/reports";

interface Props {
  value: SellerId[];
  onChange: (next: SellerId[]) => void;
}

export function SellerMultiSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const allSelected = value.length === 0;

  const toggle = (id: SellerId) => {
    if (value.includes(id)) onChange(value.filter(x => x !== id));
    else onChange([...value, id]);
  };

  const label = allSelected
    ? "Todos los vendedores"
    : value.length === 1
      ? sellers.find(s => s.id === value[0])?.name ?? "1 vendedor"
      : `${value.length} vendedores`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="h-4 w-4" />
          {label}
          {!allSelected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="ml-1 rounded-sm hover:bg-muted p-0.5 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="end">
        <button
          onClick={() => { onChange([]); setOpen(false); }}
          className={cn(
            "w-full flex items-center justify-between rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors",
            allSelected && "bg-primary/10 text-primary font-medium",
          )}
        >
          Todos los vendedores
          {allSelected && <Check className="h-4 w-4" />}
        </button>
        <div className="border-t border-border my-1" />
        {sellers.map(s => {
          const checked = value.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className="w-full flex items-center justify-between rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-muted grid place-items-center text-[10px] font-bold">
                  {s.initials}
                </span>
                {s.name}
              </span>
              {checked && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}