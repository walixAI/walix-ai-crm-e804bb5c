import { useEffect, useRef, useState, useCallback } from "react";
import { suggestTypification } from "@/lib/queries/typifications";

/** One automatic suggestion per outcome/opening; editing notes never invokes AI. */
export function useTypificationSuggestion({ open, contactId, callId, outcomeId, enabled, initialNote, note, onSuggestion }: {
  open: boolean; contactId: string | null; callId: string | null; outcomeId: string;
  enabled: boolean; initialNote: string; note: string; onSuggestion: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const session = `${open}:${contactId}:${callId}`;
  const current = useRef(session);
  const cache = useRef(new Map<string, Promise<string | null>>());
  if (current.current !== session) { current.current = session; cache.current = new Map(); }
  const latest = useRef({ note, initialNote, onSuggestion });
  latest.current = { note, initialNote, onSuggestion };
  const request = useCallback(async (manual: boolean) => {
    if (!open || !enabled || !contactId || !outcomeId) return;
    const scope = current.current;
    const entries = cache.current;
    const text = manual ? latest.current.note : latest.current.initialNote;
    const key = JSON.stringify([outcomeId, text.trim().slice(0, 1000)]);
    let job = entries.get(key);
    if (!job) {
      job = suggestTypification(contactId, outcomeId, text, callId);
      entries.set(key, job);
    }
    setBusy(true);
    try {
      const id = await job;
      if (scope === current.current && activeOutcome.current === outcomeId && id) latest.current.onSuggestion(id);
    } finally { if (scope === current.current && activeOutcome.current === outcomeId) setBusy(false); }
  }, [open, enabled, contactId, callId, outcomeId]);
  // Outcome changes invalidate responses, including a manual request still in flight.
  const activeOutcome = useRef(outcomeId);
  activeOutcome.current = outcomeId;
  useEffect(() => {
    if (!open || !enabled || !contactId || !outcomeId) { setBusy(false); return; }
    let cancelled = false;
    const scope = current.current;
    const entries = cache.current;
    const key = JSON.stringify([outcomeId, latest.current.initialNote.trim().slice(0, 1000)]);
    let job = entries.get(key);
    if (!job) {
      job = suggestTypification(contactId, outcomeId, latest.current.initialNote, callId);
      entries.set(key, job);
    }
    setBusy(true);
    void job.then(id => {
      if (!cancelled && scope === current.current && id) latest.current.onSuggestion(id);
    }).finally(() => { if (!cancelled && scope === current.current) setBusy(false); });
    return () => { cancelled = true; };
  }, [open, enabled, contactId, callId, outcomeId]);
  return { busy, refresh: () => request(true) };
}