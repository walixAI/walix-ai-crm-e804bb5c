import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center mb-4">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <Button className="mt-5" onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}