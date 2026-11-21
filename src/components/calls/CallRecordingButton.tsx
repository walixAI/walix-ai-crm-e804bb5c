import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

/** Fetches the recording through Walix with the user's session; the provider URL never reaches the browser. */
export async function fetchCallRecording(callId: string): Promise<{ blob: Blob; name: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/telephony-api`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ action: "recording_download", call_id: callId }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "No se pudo descargar la grabación");
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "llamada.mp3";
  return { blob: await res.blob(), name };
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function CallRecordingButton({ callId, withPlayer = false, size = "sm" }: { callId: string; withPlayer?: boolean; size?: "sm" | "icon" }) {
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<{ blob: Blob; name: string; url: string } | null>(null);
  const load = async () => {
    if (file) return file;
    const f = await fetchCallRecording(callId);
    const v = { ...f, url: URL.createObjectURL(f.blob) };
    setFile(v);
    return v;
  };
  const run = async (play: boolean) => {
    setBusy(true);
    try { const f = await load(); if (!play) save(f.blob, f.name); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {withPlayer && !file && (
          <Button size="sm" variant="outline" onClick={() => run(true)} disabled={busy}><Play className="mr-1 h-4 w-4" />Escuchar</Button>
        )}
        <Button size={size} variant="outline" onClick={() => run(false)} disabled={busy} aria-label="Descargar audio" title="Descargar audio">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{size === "sm" && <span className="ml-1">Descargar audio</span>}
        </Button>
      </div>
      {withPlayer && file && <audio controls src={file.url} className="w-full" />}
    </div>
  );
}
