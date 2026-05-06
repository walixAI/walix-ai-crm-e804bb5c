import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useContactTags, getTagMetaFromList } from "@/lib/queries/contactTags";
import { Check, Plus, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  trigger: React.ReactNode;
  current: string[];
  onToggle: (tag: string, checked: boolean) => void;
  align?: "start" | "center" | "end";
}

export function TagsPopover({ trigger, current, onToggle, align = "end" }: Props) {
  const { data: tags = [] } = useContactTags();
  const { data: tenantId } = useTenantId();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const filtered = tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  const exact = tags.find((t) => t.name.toLowerCase() === search.trim().toLowerCase());

  async function createNew() {
    const name = search.trim();
    if (!name || !tenantId) return;
    const { error } = await supabase.from("contact_tags").insert({ tenant_id: tenantId, name });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["contact-tags"] });
    onToggle(name, true);
    setSearch("");
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-2">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Tag className="h-3 w-3" /> Etiquetas
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar o crear..."
          className="h-8 text-sm mb-2"
        />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {filtered.map((t) => {
            const active = current.includes(t.name);
            const meta = getTagMetaFromList(tags, t.name);
            return (
              <button
                key={t.id}
                onClick={() => onToggle(t.name, !active)}
                className="w-full flex items-center gap-2 px-1.5 py-1 text-sm rounded-md hover:bg-muted text-left"
              >
                <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", meta.className)}>
                  {meta.icon} {t.name}
                </span>
                <span className="flex-1" />
                {active && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
          {search.trim() && !exact && (
            <Button variant="ghost" size="sm" className="w-full justify-start mt-1" onClick={createNew}>
              <Plus className="h-3.5 w-3.5" /> Crear "{search.trim()}"
            </Button>
          )}
          {filtered.length === 0 && !search.trim() && (
            <div className="text-xs text-muted-foreground italic text-center py-3">
              Sin etiquetas configuradas
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}