import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProactiveSuggestions } from "@/hooks/useAiMemory";

const STORAGE_KEY = "walix.morningBriefing.dismissed";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function MorningBriefing() {
  const { user } = useAuth();
  const { data: suggestions = [] } = useProactiveSuggestions();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === todayKey()) setDismissed(true);
    } catch { /* ignore */ }
  }, []);

  if (dismissed || suggestions.length === 0) return null;

  const top = suggestions.slice(0, 3);
  const more = suggestions.length - top.length;
  const rawName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "ahí";
  // Never render a raw email address in the greeting.
  const name = (rawName.includes("@")
    ? rawName.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
    : rawName
  ).split(" ")[0];

  function close() {
    try { localStorage.setItem(STORAGE_KEY, todayKey()); } catch { /* ignore */ }
    setDismissed(true);
  }

  function scrollToBriefing() {
    document
      .getElementById("proactive-briefing")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="relative rounded-xl bg-gradient-to-br from-indigo-900 to-indigo-800 p-6 text-white shadow-glow overflow-hidden">
      <button
        onClick={close}
        className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-200 mb-2">
        <Sparkles className="h-3.5 w-3.5" />
        Briefing matutino
      </div>
      <h2 className="text-lg md:text-xl font-semibold mb-3">
        Buenos días, {name}. Esto es lo más importante de hoy:
      </h2>
      <ul className="space-y-1.5 text-sm leading-relaxed">
        {top.map((s) => (
          <li key={s.id} className="flex gap-2">
            <span className="text-indigo-300">→</span>
            <span className="text-white/95">{s.suggestion_text}</span>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <button
          onClick={scrollToBriefing}
          className="mt-4 text-xs font-medium text-indigo-200 hover:text-white transition-colors"
        >
          + Ver {more} sugerencia{more === 1 ? "" : "s"} más →
        </button>
      )}
    </div>
  );
}