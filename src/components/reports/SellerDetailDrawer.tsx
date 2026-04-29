import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { sellerDeals, sellers, type SellerId } from "@/mock/reports";
import { formatMXN } from "@/lib/reports/format";
import { cn } from "@/lib/utils";

interface Props {
  sellerId: SellerId | null;
  open: boolean;
  onClose: () => void;
}

export function SellerDetailDrawer({ sellerId, open, onClose }: Props) {
  const seller = sellerId ? sellers.find(s => s.id === sellerId) : null;
  const deals = sellerId ? sellerDeals[sellerId] : [];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md w-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-full bg-primary/10 grid place-items-center text-sm font-bold text-primary">
              {seller?.initials}
            </span>
            {seller?.name}
          </SheetTitle>
          <SheetDescription>Deals activos y cerrados en el período</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {deals.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-8">Sin deals registrados.</p>
          ) : deals.map(d => (
            <div key={d.id} className="rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-sm truncate">{d.contact}</span>
                <span className="text-sm font-bold text-primary shrink-0">{formatMXN(d.amount)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{d.stage}</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase",
                  d.status === "won"    && "bg-success/10 text-success",
                  d.status === "lost"   && "bg-destructive/10 text-destructive",
                  d.status === "active" && "bg-primary/10 text-primary",
                )}>
                  {d.status === "won" ? "Ganado" : d.status === "lost" ? "Perdido" : `${d.daysInStage}d`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}