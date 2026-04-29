import { useState } from "react";
import { Calendar as CalendarIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type PeriodPreset, type PeriodValue, periodLabel } from "@/lib/reports/filters";

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "today",   label: "Hoy" },
  { id: "week",    label: "Esta semana" },
  { id: "month",   label: "Este mes" },
  { id: "quarter", label: "Últimos 3 meses" },
];

interface Props {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
}

export function PeriodPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");

  const apply = (preset: PeriodPreset) => {
    if (preset === "custom") {
      if (!from || !to) return;
      onChange({ preset: "custom", from, to });
    } else {
      onChange({ preset });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          {periodLabel(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <div className="space-y-1">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => apply(p.id)}
              className={cn(
                "w-full flex items-center justify-between rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors",
                value.preset === p.id && "bg-primary/10 text-primary font-medium",
              )}
            >
              {p.label}
              {value.preset === p.id && <Check className="h-4 w-4" />}
            </button>
          ))}
          <div className="border-t border-border my-2" />
          <div className="px-2 py-1 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Personalizado</div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-xs" />
              <Input type="date" value={to}   onChange={e => setTo(e.target.value)}   className="h-8 text-xs" />
            </div>
            <Button size="sm" className="w-full h-8 text-xs" onClick={() => apply("custom")} disabled={!from || !to}>
              Aplicar rango
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}