import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAiDrawer } from "@/store/aiDrawer";
import { Sparkles, Clock, Loader2, AlertTriangle, ArrowRight, KanbanSquare, MessageCircle, User as UserIcon, Inbox, ThumbsUp, ThumbsDown, Check, ListTodo, UserPlus, StickyNote, Trophy, XCircle, DollarSign, Wand2, X, Lightbulb, Pencil, RefreshCw, Send, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { AI_MODEL_LABEL, type AiAction, submitAiFeedback, type AiRating, type ProposedChange, type ProposalKind, executeProposal, previewProposal } from "@/services/ai";
import { useQueryClient } from "@tanstack/react-query";
import { QUICK_AI_PROMPTS } from "@/lib/constants/aiPrompts";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStages } from "@/lib/queries/pipeline";
import { toast } from "@/hooks/use-toast";

// ── Citation rendering ──────────────────────────────────────────────────
// Model emits inline tokens like [deal:UUID|Label], [contact:UUID|Label],
// [convo:UUID|Label]. We split each line into text + clickable chips.
const CITATION_RE = /\[(deal|contact|convo):([a-zA-Z0-9-]+)\|([^\]]+)\]/g;

function renderInline(text: string, onCite: (kind: string, id: string) => void): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  text.replace(CITATION_RE, (match, kind, id, label, offset: number) => {
    if (offset > lastIdx) {
      parts.push(renderFormatted(text.slice(lastIdx, offset), `t-${key++}`));
    }
    parts.push(
      <button
        key={`c-${key++}`}
        type="button"
        onClick={() => onCite(kind, id)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-medium transition-colors align-baseline"
      >
        {label}
      </button>,
    );
    lastIdx = offset + match.length;
    return match;
  });
  if (lastIdx < text.length) {
    parts.push(renderFormatted(text.slice(lastIdx), `t-${key++}`));
  }
  return parts;
}

function renderFormatted(s: string, key: string): ReactNode {
  const html = s
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-muted-foreground">$1</em>');
  return <span key={key} dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderMarkdown(md: string, onCite: (kind: string, id: string) => void) {
  const lines = md.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (/^\d+\.\s/.test(line) || line.startsWith("- ")) {
          const stripped = line.replace(/^(\d+\.|-)\s/, "");
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-primary">•</span>
              <span>{renderInline(stripped, onCite)}</span>
            </div>
          );
        }
        return <p key={i}>{renderInline(line, onCite)}</p>;
      })}
    </div>
  );
}

export function AiDrawer() {
  const { open, closeDrawer, current, loading, history, ask, source, errorMessage, retry } = useAiDrawer();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: stages = [] } = useStages();
  const [rating, setRating] = useState<AiRating | null>(null);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [proposalState, setProposalState] = useState<Record<string, "idle" | "running" | "done" | "error">>({});
  const [proposalError, setProposalError] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  // Preview / edit / reasoning UI per proposal
  const [previews, setPreviews] = useState<Record<string, { before?: any; after?: any; loading?: boolean; error?: string }>>({});
  const [showWhy, setShowWhy] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [editPayload, setEditPayload] = useState<Record<string, Record<string, any>>>({});
  const [livePayloads, setLivePayloads] = useState<Record<string, Record<string, any>>>({});

  const runAction = (a: AiAction) => {
    switch (a.type) {
      case "open_deal":      navigate(`/pipeline${a.id ? `?dealId=${a.id}` : ""}`); break;
      case "open_contact":   navigate(a.id ? `/contacts/${a.id}` : "/contacts"); break;
      case "open_conversation": navigate(`/whatsapp${a.id ? `?conversationId=${a.id}` : ""}`); break;
      case "open_pipeline":  navigate("/pipeline"); break;
      case "open_inbox":     navigate("/ai-inbox"); break;
    }
    closeDrawer();
  };

  const handleCitation = (kind: string, id: string) => {
    if (kind === "deal") navigate(`/pipeline?dealId=${id}`);
    else if (kind === "contact") navigate(`/contacts/${id}`);
    else if (kind === "convo") navigate(`/whatsapp?conversationId=${id}`);
    closeDrawer();
  };

  // Reset feedback state whenever a new answer arrives
  useEffect(() => {
    setRating(null);
    setShowCommentBox(false);
    setComment("");
    setProposalState({});
    setProposalError({});
    setDismissed({});
    setPreviews({});
    setShowWhy({});
    setEditing({});
    setEditPayload({});
    setLivePayloads({});
  }, [current?.id]);

  // Auto-fetch preview for each new proposal.
  useEffect(() => {
    const list = current?.proposals ?? [];
    list.forEach((p) => {
      if (previews[p.id]) return;
      setPreviews((s) => ({ ...s, [p.id]: { loading: true } }));
      previewProposal({ ...p, payload: livePayloads[p.id] ?? p.payload }).then((res) => {
        setPreviews((s) => ({
          ...s,
          [p.id]: res.ok
            ? { before: res.before, after: res.after }
            : { error: res.error },
        }));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const refreshPreview = (p: ProposedChange, payload: Record<string, any>) => {
    setPreviews((s) => ({ ...s, [p.id]: { loading: true } }));
    previewProposal({ ...p, payload }).then((res) => {
      setPreviews((s) => ({
        ...s,
        [p.id]: res.ok ? { before: res.before, after: res.after } : { error: res.error },
      }));
    });
  };

  const sendFeedback = async (r: AiRating, withComment = false) => {
    if (!current) return;
    if (r === -1 && withComment === false && !showCommentBox) {
      // Show comment box first for negative feedback
      setRating(-1);
      setShowCommentBox(true);
      return;
    }
    setSubmitting(true);
    const res = await submitAiFeedback({
      prompt: current.prompt,
      answer: current.answer,
      rating: r,
      comment: comment.trim() || undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      setRating(r);
      setShowCommentBox(false);
      setComment("");
      toast({ title: "Gracias por tu feedback", description: r === 1 ? "Nos ayuda a afinar Walix IA." : "Lo tendremos en cuenta para mejorar." });
    } else {
      toast({ title: "No se pudo guardar", description: res.error ?? "Intenta de nuevo.", variant: "destructive" });
    }
  };

  const iconFor = (t: AiAction["type"]) =>
    t === "open_deal" ? KanbanSquare
    : t === "open_conversation" ? MessageCircle
    : t === "open_contact" ? UserIcon
    : t === "open_pipeline" ? KanbanSquare
    : Inbox;

  const proposalIcon = (kind: ProposalKind) => {
    switch (kind) {
      case "update_deal_stage": return KanbanSquare;
      case "update_deal_amount": return DollarSign;
      case "mark_deal_won": return Trophy;
      case "mark_deal_lost": return XCircle;
      case "create_task": return ListTodo;
      case "create_activity": return StickyNote;
      case "update_contact": return UserIcon;
      case "create_contact": return UserPlus;
      default: return Wand2;
    }
  };

  const invalidateForKind = (kind: ProposalKind) => {
    if (kind.startsWith("update_deal") || kind.startsWith("mark_deal")) {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    }
    if (kind === "create_task") queryClient.invalidateQueries({ queryKey: ["tasks"] });
    if (kind === "create_activity") queryClient.invalidateQueries({ queryKey: ["activities"] });
    if (kind === "update_contact" || kind === "create_contact") queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["audit-log"] });
  };

  const confirmProposal = async (p: ProposedChange) => {
    setProposalState((s) => ({ ...s, [p.id]: "running" }));
    const finalPayload = livePayloads[p.id] ?? p.payload;
    const res = await executeProposal({ ...p, payload: finalPayload }, { prompt: current?.prompt });
    if (res.ok) {
      setProposalState((s) => ({ ...s, [p.id]: "done" }));
      invalidateForKind(p.kind);
      toast({ title: "Cambio aplicado", description: p.summary.replace(/\*\*/g, "") });
    } else {
      setProposalState((s) => ({ ...s, [p.id]: "error" }));
      setProposalError((s) => ({ ...s, [p.id]: res.error ?? "Error" }));
      toast({ title: "No se pudo aplicar", description: res.error ?? "Error", variant: "destructive" });
    }
  };

  const visibleProposals = (current?.proposals ?? []).filter((p) => !dismissed[p.id]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && closeDrawer()}>
      <SheetContent side="right" className="w-full sm:max-w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border bg-gradient-to-br from-primary/5 to-accent/5">
          <SheetTitle className="flex items-center justify-between gap-2 text-base">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 grid place-items-center rounded-lg bg-gradient-brand text-primary-foreground shadow-glow">
                <Sparkles className="h-4 w-4" />
              </div>
              <span>Walix IA</span>
            </div>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wide">
              {AI_MODEL_LABEL}
            </span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-6" key={current?.id ?? "empty"}>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Analizando tus datos…
              </div>
            )}

            {current && !loading && source !== "error" && (
              <div className="space-y-3">
                <div className="rounded-xl bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Tú: </span>
                  {current.prompt}
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  {renderMarkdown(current.answer, handleCitation)}
                </div>
                {current.actions && current.actions.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Acciones sugeridas
                    </div>
                    {current.actions.map((a, i) => {
                      const Icon = iconFor(a.type);
                      return (
                        <button
                          key={i}
                          onClick={() => runAction(a)}
                          className="w-full group flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-background hover:bg-primary/5 hover:border-primary/40 transition-colors px-3 py-2 text-sm"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate text-foreground">{a.label}</span>
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {visibleProposals.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Wand2 className="h-3 w-3 text-accent" />
                      Cambios propuestos · requieren tu confirmación
                    </div>
                    {visibleProposals.map((p) => {
                      const Icon = proposalIcon(p.kind);
                      const state = proposalState[p.id] ?? "idle";
                      const preview = previews[p.id];
                      const isEditing = !!editing[p.id];
                      const draft = editPayload[p.id] ?? {};
                      return (
                        <div
                          key={p.id}
                          className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <div className="h-7 w-7 grid place-items-center rounded-md bg-accent/15 text-accent shrink-0">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 text-xs leading-relaxed text-foreground">
                              {renderInline(p.summary, handleCitation)}
                            </div>
                          </div>

                          {/* Diff before → after */}
                          {!isEditing && (
                            <div className="pl-9">
                              {preview?.loading && (
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> Calculando vista previa…
                                </div>
                              )}
                              {preview?.error && (
                                <div className="text-[10px] text-destructive">{preview.error}</div>
                              )}
                              {preview && !preview.loading && !preview.error && (
                                <DiffTable before={preview.before} after={preview.after} />
                              )}
                            </div>
                          )}

                          {/* Reasoning collapsible */}
                          {p.reasoning && !isEditing && showWhy[p.id] && (
                            <div className="pl-9 text-[11px] text-muted-foreground bg-background/60 rounded-md border border-border/60 px-2 py-1.5 flex gap-1.5">
                              <Lightbulb className="h-3 w-3 text-accent shrink-0 mt-0.5" />
                              <span>{p.reasoning}</span>
                            </div>
                          )}

                          {/* Inline edit form */}
                          {isEditing && (
                            <div className="pl-9 space-y-2 rounded-md bg-background/80 border border-border/60 p-2">
                              <ProposalEditForm
                                kind={p.kind}
                                payload={draft}
                                stages={stages.map((s) => ({ id: s.id, name: s.name }))}
                                onChange={(next) => setEditPayload((s) => ({ ...s, [p.id]: next }))}
                              />
                              <div className="flex gap-1.5 justify-end">
                                <Button size="sm" variant="ghost" className="h-7 text-xs"
                                  onClick={() => { setEditing((s) => ({ ...s, [p.id]: false })); }}>
                                  Cancelar
                                </Button>
                                <Button size="sm" className="h-7 text-xs"
                                  onClick={() => {
                                    const merged = { ...(livePayloads[p.id] ?? p.payload), ...draft };
                                    setLivePayloads((s) => ({ ...s, [p.id]: merged }));
                                    setEditing((s) => ({ ...s, [p.id]: false }));
                                    refreshPreview(p, merged);
                                  }}>
                                  Aplicar cambios
                                </Button>
                              </div>
                            </div>
                          )}

                          {state === "done" ? (
                            <div className="flex items-center gap-1.5 text-[11px] text-success pl-9">
                              <Check className="h-3 w-3" /> Ejecutado · queda en auditoría
                            </div>
                          ) : state === "error" ? (
                            <div className="space-y-1.5 pl-9">
                              <div className="text-[11px] text-destructive">{proposalError[p.id] ?? "Error"}</div>
                              <div className="flex gap-1.5">
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => confirmProposal(p)}>
                                  Reintentar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDismissed((d) => ({ ...d, [p.id]: true }))}>
                                  Descartar
                                </Button>
                              </div>
                            </div>
                          ) : !isEditing ? (
                            <div className="flex gap-1 pl-9 flex-wrap">
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                disabled={state === "running"}
                                onClick={() => confirmProposal(p)}
                              >
                                {state === "running" ? (
                                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Aplicando…</>
                                ) : (
                                  <><Check className="h-3 w-3 mr-1" /> Confirmar</>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={state === "running"}
                                onClick={() => {
                                  setEditPayload((s) => ({ ...s, [p.id]: { ...(livePayloads[p.id] ?? p.payload) } }));
                                  setEditing((s) => ({ ...s, [p.id]: true }));
                                }}
                              >
                                <Pencil className="h-3 w-3 mr-1" /> Editar
                              </Button>
                              {p.reasoning && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => setShowWhy((s) => ({ ...s, [p.id]: !s[p.id] }))}
                                >
                                  <Lightbulb className="h-3 w-3 mr-1" /> {showWhy[p.id] ? "Ocultar" : "¿Por qué?"}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                disabled={state === "running"}
                                onClick={() => setDismissed((d) => ({ ...d, [p.id]: true }))}
                              >
                                <X className="h-3 w-3 mr-1" /> Descartar
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Feedback row */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    ¿Te fue útil?
                  </span>
                  {rating !== null ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-success">
                      <Check className="h-3 w-3" /> Feedback enviado
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => sendFeedback(1)}
                        className="h-7 w-7 grid place-items-center rounded-md border border-border hover:bg-success/10 hover:border-success/40 hover:text-success transition-colors disabled:opacity-50"
                        aria-label="Útil"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => sendFeedback(-1)}
                        className="h-7 w-7 grid place-items-center rounded-md border border-border hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive transition-colors disabled:opacity-50"
                        aria-label="No útil"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {showCommentBox && rating === null && (
                  <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <div className="text-xs font-medium text-foreground">¿Qué falló?</div>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Opcional: cuéntanos para afinar las respuestas…"
                      className="text-xs min-h-[60px]"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => { setShowCommentBox(false); setComment(""); }}>
                        Cancelar
                      </Button>
                      <Button size="sm" disabled={submitting} onClick={() => sendFeedback(-1, true)}>
                        Enviar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!current && !loading && (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Pregúntame lo que sea sobre tu pipeline, leads o equipo.
                </div>
                <div className="space-y-1.5">
                  {QUICK_AI_PROMPTS.slice(0, 4).map((p) => (
                    <button
                      key={p}
                      onClick={() => ask(p)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted hover:border-primary/30 transition-colors flex items-center gap-2"
                    >
                      <Sparkles className="h-3 w-3 text-accent shrink-0" />
                      <span className="truncate">{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {current && !loading && source === "error" && (
              <div className="space-y-3">
                <div className="rounded-xl bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Tú: </span>
                  {current.prompt}
                </div>
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 space-y-2">
                <div className="flex items-start gap-2 text-[12px] text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold">No pude conectar con el servicio de IA</div>
                    <div className="text-[11px] text-destructive/80 mt-0.5">
                      Intenta de nuevo en unos segundos.
                    </div>
                    {errorMessage && (
                      <div className="text-[10px] text-destructive/80 mt-0.5 break-words">{errorMessage}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 justify-end">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={closeDrawer}>Cerrar</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={() => retry()}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Reintentar
                  </Button>
                </div>
                </div>
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

// ─── Auxiliary components ──────────────────────────────────────────────

function DiffTable({ before, after }: { before?: any; after?: any }) {
  const isCreate = !before || Object.keys(before ?? {}).length === 0;
  const fields = Object.keys(after ?? {});
  if (!fields.length) return null;
  if (isCreate) {
    return (
      <div className="rounded-md border border-border/60 bg-background/60 p-2 mt-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Nuevo registro
        </div>
        <div className="space-y-0.5">
          {fields.map((k) => (
            <div key={k} className="flex justify-between gap-2 text-[11px]">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-foreground font-medium truncate max-w-[60%] text-right">{String(after[k] ?? "—")}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // Diff view
  const changed = fields.filter((k) => String(before?.[k] ?? "") !== String(after?.[k] ?? ""));
  if (!changed.length) {
    return <div className="text-[10px] text-muted-foreground italic mt-1">Sin cambios efectivos.</div>;
  }
  return (
    <div className="rounded-md border border-border/60 bg-background/60 p-2 mt-1 space-y-1">
      {changed.map((k) => (
        <div key={k} className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground">{k}</span>
          <span className="text-muted-foreground line-through truncate text-right">{String(before?.[k] ?? "—")}</span>
          <ArrowRight className="h-3 w-3 text-accent" />
          <span className="text-foreground font-medium truncate">{String(after?.[k] ?? "—")}</span>
        </div>
      ))}
    </div>
  );
}

function ProposalEditForm({
  kind,
  payload,
  stages,
  onChange,
}: {
  kind: ProposalKind;
  payload: Record<string, any>;
  stages?: { id: string; name: string }[];
  onChange: (next: Record<string, any>) => void;
}) {
  const set = (k: string, v: any) => onChange({ ...payload, [k]: v });

  const Field = ({ label, k, type = "text", placeholder }: { label: string; k: string; type?: string; placeholder?: string }) => (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={payload[k] ?? ""}
        placeholder={placeholder}
        onChange={(e) => set(k, type === "number" ? Number(e.target.value) : e.target.value)}
        className="h-8 text-xs"
      />
    </div>
  );

  const EnumField = ({ label, k, options }: { label: string; k: string; options: string[] }) => (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Select value={payload[k] ?? ""} onValueChange={(v) => set(k, v)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const STATUS_OPTS = ["Nuevo", "Contactado", "Calificado", "Propuesta", "Cerrado", "Perdido"];
  const ACTIVITY_OPTS = ["note", "deal", "task", "wa_sent", "wa_received"];

  switch (kind) {
    case "update_deal_amount":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Monto" k="amount" type="number" />
          <Field label="Probabilidad %" k="probability" type="number" />
        </div>
      );
    case "update_deal_stage":
      return (
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Etapa destino</Label>
          <Select value={payload.stage_id ?? ""} onValueChange={(v) => set("stage_id", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecciona etapa…" /></SelectTrigger>
            <SelectContent>
              {(stages ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
              ))}
              {(!stages || stages.length === 0) && (
                <div className="px-2 py-1 text-[11px] text-muted-foreground">Sin etapas disponibles</div>
              )}
            </SelectContent>
          </Select>
        </div>
      );
    case "create_task":
      return (
        <div className="space-y-2">
          <Field label="Título" k="title" />
          <Field label="Vence (ISO)" k="due_at" placeholder="2025-05-15T10:00:00Z" />
        </div>
      );
    case "create_activity":
      return (
        <div className="space-y-2">
          <EnumField label="Tipo" k="type" options={ACTIVITY_OPTS} />
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Descripción</Label>
            <Textarea
              value={payload.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              className="text-xs min-h-[60px]"
            />
          </div>
        </div>
      );
    case "update_contact":
    case "create_contact":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nombre" k="name" />
          <Field label="Apellido" k="last_name" />
          <Field label="Teléfono" k="phone" />
          <Field label="Email" k="email" />
          <Field label="Empresa" k="company" />
          <Field label="Puesto" k="position" />
          <div className="col-span-2">
            <EnumField label="Estado" k="status" options={STATUS_OPTS} />
          </div>
        </div>
      );
    case "mark_deal_lost":
      return (
        <div className="space-y-2">
          <Field label="Motivo" k="lost_reason" />
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Comentario</Label>
            <Textarea
              value={payload.lost_comment ?? ""}
              onChange={(e) => set("lost_comment", e.target.value)}
              className="text-xs min-h-[50px]"
            />
          </div>
        </div>
      );
    case "mark_deal_won":
      return <div className="text-[11px] text-muted-foreground">No hay parámetros editables.</div>;
    default:
      return null;
  }
}
