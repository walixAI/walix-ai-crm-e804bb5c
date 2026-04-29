import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  text: string;
  cta?: { label: string; onClick: () => void };
  tone?: "primary" | "warning" | "success";
  className?: string;
}

const TONE = {
  primary: "border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5",
  warning: "border-warning/20 bg-gradient-to-br from-warning/5 to-warning/10",
  success: "border-success/20 bg-gradient-to-br from-success/5 to-success/10",
};

const ICON_TONE = {
  primary: "text-primary",
  warning: "text-warning",
  success: "text-success",
};

export function InsightCard({ text, cta, tone = "primary", className }: InsightCardProps) {
  return (
    <div className={cn("rounded-xl border p-4 flex items-start gap-3", TONE[tone], className)}>
      <Sparkles className={cn("h-4 w-4 mt-0.5 shrink-0", ICON_TONE[tone])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed text-foreground">{text}</p>
        {cta && (
          <button
            type="button"
            onClick={cta.onClick}
            className={cn(
              "mt-2 inline-flex items-center gap-1 text-xs font-semibold hover:underline",
              ICON_TONE[tone],
            )}
          >
            {cta.label} <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}