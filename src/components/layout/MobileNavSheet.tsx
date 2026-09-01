import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { WBadge } from "@/components/walix/Badge";
import { cn } from "@/lib/utils";
import { useNavItems } from "./navItems";
import { useEffect } from "react";

export function MobileNavSheet() {
  const [open, setOpen] = useState(false);
  const { items, adminItems } = useNavItems();
  const location = useLocation();

  // Close the drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[86vw] max-w-[320px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border text-left">
          <SheetTitle>Menú</SheetTitle>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {items.map((item) => <Row key={item.to} item={item} />)}
          {adminItems.length > 0 && (
            <>
              <div className="mt-5 mb-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Admin
              </div>
              {adminItems.map((item) => <Row key={item.to} item={item} />)}
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function Row({ item }: { item: ReturnType<typeof useNavItems>["items"][number] }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => cn(
        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
        isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", item.accent && "text-accent")} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? <WBadge variant="brand">{item.badge}</WBadge> : null}
    </NavLink>
  );
}
