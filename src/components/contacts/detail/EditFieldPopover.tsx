import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Props {
  trigger: React.ReactNode;
  label: string;
  value: string;
  type?: "email" | "tel" | "text";
  placeholder?: string;
  prefix?: string;
  onSave: (val: string) => void | Promise<void>;
  align?: "start" | "center" | "end";
}

export function EditFieldPopover({
  trigger, label, value, type = "text", placeholder, prefix, onSave, align = "start",
}: Props) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(value);
  useEffect(() => { if (open) setVal(value ?? ""); }, [open, value]);

  function validate(v: string) {
    if (type === "email" && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return "Email inválido";
    if (type === "tel" && v && !/^[\d\s+()-]{6,}$/.test(v)) return "Teléfono inválido";
    return null;
  }
  const err = validate(val.trim());

  async function save() {
    if (err) return;
    await onSave(val.trim());
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-72 p-3 space-y-2">
        <Label className="text-xs">{label}</Label>
        <div className="flex gap-2">
          {prefix && (
            <div className="h-9 px-2 rounded-md border border-input bg-muted/50 flex items-center text-xs font-medium">{prefix}</div>
          )}
          <Input
            type={type}
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            className="h-9 flex-1"
          />
        </div>
        {err && <p className="text-[11px] text-destructive">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={!!err}>Guardar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}