import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface DealListItem {
  id: string;
  name: string;
  amount: number;
  stageName?: string;
  ownerName?: string;
  extra?: string;
}

function mxn(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

export function DealsListDialog({
  open, onOpenChange, title, description, deals,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  deals: DealListItem[];
}) {
  const navigate = useNavigate();
  const total = deals.reduce((s, d) => s + d.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ? `${description} · ` : ""}{deals.length} oportunidad{deals.length === 1 ? "" : "es"} · {mxn(total)}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-2">
            {deals.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin oportunidades en este grupo.</p>
            )}
            {deals.map((d) => (
              <button
                key={d.id}
                onClick={() => { onOpenChange(false); navigate(`/pipeline?dealId=${d.id}`); }}
                className="w-full text-left rounded-lg border border-border p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-sm truncate">{d.name}</span>
                  <span className="text-sm font-bold text-primary shrink-0">{mxn(d.amount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    {[d.stageName, d.ownerName, d.extra].filter(Boolean).join(" · ")}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
