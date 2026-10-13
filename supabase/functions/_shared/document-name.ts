export const MAX_DOCUMENT_TITLE = 64;

/** A readable, bounded title from the filename, without guessing document content. */
export function shortDocumentTitle(value: string): string {
  const title = value.normalize("NFC")
    .replace(/\.(pdf|jpe?g|png|xlsx?|csv)$/i, "")
    .replace(/[_\s]+/g, " ").replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (!title) return "Documento";
  if (title.length <= MAX_DOCUMENT_TITLE) return title;
  const prefix = title.slice(0, MAX_DOCUMENT_TITLE);
  const lastSpace = prefix.lastIndexOf(" ");
  return (lastSpace >= MAX_DOCUMENT_TITLE / 2 ? prefix.slice(0, lastSpace) : prefix).trim();
}

export function documentFilename(name: string, storagePath: string): string {
  const ext = storagePath.match(/\.(pdf|jpe?g|png|xlsx?|csv)$/i)?.[1]?.toLowerCase();
  const title = shortDocumentTitle(name).replace(/[\\/:*?"<>|]/g, "-");
  return `${title}${ext ? `.${ext}` : ""}`;
}