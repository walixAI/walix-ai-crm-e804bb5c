import type { ReactNode } from "react";

export type CitationKind = "deal" | "contact" | "conversation" | "convo";
export type CitationHandler = (kind: string, id: string) => void;

const CITATION_RE = /\[(deal|opportunity|contact|conversation|convo):([a-zA-Z0-9-]+)\|([^\]]+)\]/g;

/**
 * Render a string that may contain citation tokens like
 * `[deal:UUID|Label]` into React nodes with clickable buttons.
 */
export function renderCitations(text: string, onCite: CitationHandler): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  text.replace(CITATION_RE, (match, kind, id, label, off: number) => {
    if (off > last) parts.push(<span key={`t-${key++}`}>{text.slice(last, off)}</span>);
    parts.push(
      <button
        key={`c-${key++}`}
        type="button"
        onClick={() => onCite(kind, id)}
        className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-medium transition-colors"
      >
        {label}
      </button>,
    );
    last = off + match.length;
    return match;
  });
  if (last < text.length) parts.push(<span key={`t-${key++}`}>{text.slice(last)}</span>);
  return parts;
}

/** Strip citation tokens from a string, leaving just the labels. */
export function stripCitations(text: string): string {
  return text.replace(CITATION_RE, (_m, _kind, _id, label) => label);
}

export function formatMXN(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}