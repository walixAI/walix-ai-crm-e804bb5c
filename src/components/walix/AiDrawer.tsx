import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAiDrawer } from "@/store/aiDrawer";
import { Sparkles, Clock, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

function renderMarkdown(md: string) {
  // very small markdown: **bold**, *italic*, lists, line breaks
  const lines = md.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const html = line
          .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
          .replace(/\*(.+?)\*/g, '<em class="text-muted-foreground">$1</em>');
        if (/^\d+\.\s/.test(line) || line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-primary">•</span>
              <span dangerouslySetInnerHTML={{ __html: html.replace(/^(\d+\.|-)\s/, "") }} />
            </div>
          );
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

export function AiDrawer() {
  const { open, closeDrawer, current, loading, history, ask } = useAiDrawer();

  return (
    <Sheet open={open} onOpenChange={(v) => !v && closeDrawer()}>
      <SheetContent side="right" className="w-full sm:max-w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border bg-gradient-to-br from-primary/5 to-accent/5">
          <SheetTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 grid place-items-center rounded-lg bg-gradient-brand text-primary-foreground shadow-glow">
              <Sparkles className="h-4 w-4" />
            </div>
            Walix IA
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-6">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Analizando tus datos…
              </div>
            )}

            {current && !loading && (
              <div className="space-y-3">
                <div className="rounded-xl bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Tú: </span>
                  {current.prompt}
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  {renderMarkdown(current.answer)}
                </div>
              </div>
            )}

            {!current && !loading && (
              <div className="text-sm text-muted-foreground">
                Pregúntame lo que sea sobre tu pipeline, leads o equipo.
              </div>
            )}

            {history.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  <Clock className="h-3 w-3" /> Historial reciente
                </div>
                <div className="space-y-1.5">
                  {history.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => ask(q.prompt)}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-muted transition-colors flex items-start justify-between gap-2"
                    >
                      <span className="truncate flex-1 text-foreground">{q.prompt}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{q.at}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <Button variant="outline" className="w-full" onClick={closeDrawer}>Cerrar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
