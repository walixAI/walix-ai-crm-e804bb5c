import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Check, ChevronLeft } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

function toDateRange(value: PeriodValue): DateRange | undefined {
  if (value.preset !== "custom" || !value.from || !value.to) return undefined;
  return { from: parseISO(value.from), to: parseISO(value.to) };
}

export function PeriodPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(value.preset === "custom");
  const [range, setRange] = useState<DateRange | undefined>(toDateRange(value));

  const applyPreset = (preset: PeriodPreset) => {
    onChange({ preset });
    setCustomMode(false);
    setOpen(false);
  };

  const handleSelect = (next: DateRange | undefined) => {
    setRange(next);
    // Un solo gesto: al elegir inicio y fin se aplica y se cierra.
    if (next?.from && next?.to) {
      onChange({
        preset: "custom",
        from: format(next.from, "yyyy-MM-dd"),
        to: format(next.to, "yyyy-MM-dd"),
      });
      setOpen(false);
    }
  };

  const openCustom = () => {
    setRange(undefined);
    setCustomMode(true);
  };

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      setCustomMode(value.preset === "custom");
      if (o) setRange(undefined);
    }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          {periodLabel(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="end">
        {!customMode ? (
          <div className="w-56 space-y-1">
            {PRESETS.map(p => (
              <Button
                variant="ghost"
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={cn(
                  "w-full flex items-center justify-between rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors",
                  value.preset === p.id && "bg-primary/10 text-primary font-medium",
                )}
              >
                {p.label}
                {value.preset === p.id && <Check className="h-4 w-4" />}
              </Button>
            ))}
            <div className="border-t border-border my-2" />
            <Button
              variant="ghost"
              onClick={openCustom}
              className={cn(
                "w-full flex items-center justify-between rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors",
                value.preset === "custom" && "bg-primary/10 text-primary font-medium",
              )}
            >
              Personalizado
              {value.preset === "custom" && <Check className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 px-1 pb-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCustomMode(false)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-xs font-medium text-muted-foreground">
                Elige la fecha de inicio y la final
              </div>
            </div>
            <Calendar
              mode="range"
              selected={range}
              defaultMonth={toDateRange(value)?.from}
              onSelect={handleSelect}
              numberOfMonths={1}
              locale={es}
              disabled={{ after: new Date() }}
              initialFocus
              className={cn("p-2 pointer-events-auto")}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
