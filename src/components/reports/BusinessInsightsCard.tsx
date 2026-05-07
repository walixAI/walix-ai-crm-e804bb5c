import { useEffect, useState } from "react";
import { Brain, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { listTenantPatterns, countOutcomeFeedback, type TenantPattern } from "@/services/learning";
import { PATTERN_ICONS, formatPatternEs, confidenceLabel } from "@/lib/reports/patternFormatters";

const MIN_SAMPLE = 20;

export function BusinessInsightsCard() {
  const [loading, setLoading] = useState(true);
  const [patterns, setPatterns] = useState<TenantPattern[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [p, c] = await Promise.all([listTenantPatterns(), countOutcomeFeedback()]);
        if (!active) return;
        setPatterns(p);
        setCount(c);
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const enoughData = count >= MIN_SAMPLE && patterns.length > 0;
  const avgConf = patterns.length
    ? patterns.reduce((a, p) => a + p.confidence_score, 0) / patterns.length
    : 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            Lo que aprendimos de tu equipo
          </CardTitle>
          {enoughData && (
            <Badge variant="outline" className="text-[10px]">
              Basado en {count} eventos · Confianza: {confidenceLabel(avgConf)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </>
        ) : !enoughData ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Recopilando datos para aprender los patrones de tu negocio…
            </p>
            <Progress value={Math.min(100, (count / MIN_SAMPLE) * 100)} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {count}/{MIN_SAMPLE} eventos analizados. Cuando tengamos suficientes, el Aprendiz mostrará insights aquí cada domingo.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {patterns.map((p) => {
              const Icon = PATTERN_ICONS[p.pattern_type] ?? Sparkles;
              return (
                <li key={p.id} className="flex items-start gap-2 text-sm">
                  <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{formatPatternEs(p.pattern_type, p.pattern_data)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
