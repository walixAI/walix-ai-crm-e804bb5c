import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function CopilotImpactCard() {
  const [stats, setStats] = useState<{ total: number; edited: number; replyEdited: number; replyOriginal: number; avgHrs: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("v_ai_draft_ab" as any)
        .select("was_edited, got_reply, reply_within_hours")
        .limit(1000);
      const rows = (data ?? []) as any[];
      const edited = rows.filter(r => r.was_edited);
      const original = rows.filter(r => !r.was_edited);
      const editedReplies = edited.filter(r => r.got_reply).length;
      const originalReplies = original.filter(r => r.got_reply).length;
      const allHrs = rows.filter(r => r.reply_within_hours != null).map(r => Number(r.reply_within_hours));
      const avgHrs = allHrs.length ? allHrs.reduce((a, b) => a + b, 0) / allHrs.length : 0;
      setStats({
        total: rows.length,
        edited: edited.length,
        replyEdited: edited.length ? editedReplies / edited.length : 0,
        replyOriginal: original.length ? originalReplies / original.length : 0,
        avgHrs,
      });
    })();
  }, []);

  if (!stats) return null;
  const conf = stats.total >= 50 ? "Alta" : stats.total >= 20 ? "Media" : "Baja";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Impacto del Copiloto</CardTitle>
        <CardDescription>Tasa de respuesta — borradores originales vs. editados</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.total < 5 ? (
          <p className="text-sm text-muted-foreground">Recopilando datos… enviar más mensajes con el Copiloto para ver el impacto.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">Originales</div>
                <div className="text-2xl font-bold">{Math.round(stats.replyOriginal * 100)}%</div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">Editados</div>
                <div className="text-2xl font-bold">{Math.round(stats.replyEdited * 100)}%</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Tiempo promedio a respuesta: {stats.avgHrs.toFixed(1)} h
            </div>
            <Badge variant="secondary" className="text-[10px]">
              Basado en {stats.total} mensajes · Confianza {conf}
            </Badge>
          </>
        )}
      </CardContent>
    </Card>
  );
}
