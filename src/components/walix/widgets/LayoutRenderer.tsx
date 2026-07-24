import { Children, isValidElement, ReactNode, useMemo } from "react";
import { useResolvedLayout, type Surface } from "@/lib/queries/dashboardLayout";

interface WidgetProps {
  k: string;
  children: ReactNode;
}

/**
 * Marker component. Only renders children when placed inside <LayoutRenderer>.
 * `k` must match a dashboard_widgets.key entry.
 */
export function Widget({ children }: WidgetProps) {
  return <>{children}</>;
}
// Tag so LayoutRenderer can identify markers.
(Widget as any).__isWidgetMarker = true;

interface LayoutRendererProps {
  surface: Surface;
  children: ReactNode;
  /** Ignored keys are always rendered (never hidden). */
  alwaysVisible?: string[];
}

export function LayoutRenderer({ surface, children, alwaysVisible = [] }: LayoutRendererProps) {
  const layout = useResolvedLayout(surface);

  const items = useMemo(() => {
    const kids = Children.toArray(children).filter(isValidElement);
    const marked = kids
      .map((child) => {
        const type: any = (child as any).type;
        const k: string | undefined = (child as any).props?.k;
        const isMarker = type && type.__isWidgetMarker;
        return { child, k, isMarker: !!isMarker };
      });
    // Non-marker children keep original order at position -Infinity (rendered first, as-is).
    return marked.map((m) => {
      if (!m.isMarker || !m.k) return { child: m.child, position: -1e9, hidden: false, key: null as string | null };
      const resolved = layout.byKey(m.k);
      const alwaysOn = alwaysVisible.includes(m.k);
      return {
        child: m.child,
        position: resolved?.position ?? 999,
        hidden: alwaysOn ? false : (resolved?.hidden ?? false),
        key: m.k,
      };
    }).filter((x) => !x.hidden)
      .sort((a, b) => a.position - b.position);
  }, [children, layout, alwaysVisible]);

  return <>{items.map((it, i) => <div key={it.key ?? `_${i}`} data-widget-key={it.key ?? undefined}>{it.child}</div>)}</>;
}