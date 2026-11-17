import { useEffect, useState } from "react";
import { Mic, Volume2, RefreshCw, Headphones, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface AudioSelection { input: string; output: string }
export interface CallAudioRouting {
  isOutputSelectionSupported: boolean;
  setInputDevice: (id: string) => Promise<void>;
  speakerDevices: { set: (id: string) => Promise<void> };
}

export async function applyCallAudio(audio: CallAudioRouting, selection: AudioSelection) {
  if (selection.input !== "default") await audio.setInputDevice(selection.input);
  if (audio.isOutputSelectionSupported) await audio.speakerDevices.set(selection.output);
}

interface Props {
  selection: AudioSelection;
  onChange: (selection: AudioSelection) => void;
  audio?: CallAudioRouting | null;
}

export function CallAudioControls({ selection, onChange, audio }: Props) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const outputSupported = audio?.isOutputSelectionSupported ?? (typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype);

  async function refresh(requestPermission = false) {
    setBusy(true); setError("");
    try {
      if (!navigator.mediaDevices?.enumerateDevices) throw new Error("unsupported");
      if (requestPermission) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch { setError("No se pudo acceder al audio. Revisa el permiso del micrófono."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    void refresh();
    const media = navigator.mediaDevices;
    if (!media) return;
    const update = () => void refresh();
    media.addEventListener?.("devicechange", update);
    return () => media.removeEventListener?.("devicechange", update);
  }, []);

  async function select(kind: "input" | "output", id: string) {
    setBusy(true); setError("");
    try {
      if (audio) {
        if (kind === "input") await audio.setInputDevice(id);
        else await audio.speakerDevices.set(id);
      }
      onChange({ ...selection, [kind]: id });
    } catch { setError("No se pudo cambiar el dispositivo. Comprueba que siga conectado."); }
    finally { setBusy(false); }
  }

  return <section className="dialer-audio space-y-3 border-t border-border pt-4" aria-label="Dispositivos de audio">
    <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><Headphones className="h-4 w-4" />Audio de la llamada</h3><Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} title="Actualizar dispositivos" aria-label="Actualizar dispositivos" onClick={() => void refresh(true)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button></div>
    {(["input", "output"] as const).map((kind) => {
      const list = devices.filter((d) => d.kind === (kind === "input" ? "audioinput" : "audiooutput") && d.deviceId && d.deviceId !== "default");
      const value = list.some((d) => d.deviceId === selection[kind]) ? selection[kind] : "default";
      return <div key={kind} className="space-y-1.5"><p className="flex items-center gap-2 text-xs text-muted-foreground">{kind === "input" ? <Mic className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}{kind === "input" ? "Micrófono · entrada" : "Escuchar por · salida"}</p>
        <Select value={value} onValueChange={(id) => void select(kind, id)} disabled={busy || (kind === "output" && !outputSupported)}><SelectTrigger className="dialer-notes w-full text-left" aria-label={kind === "input" ? "Micrófono" : "Salida de audio"}><SelectValue /></SelectTrigger><SelectContent className="max-w-[calc(100vw-3rem)]"><SelectItem value="default">Predeterminado del dispositivo</SelectItem>{list.map((d, i) => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `${kind === "input" ? "Micrófono" : "Salida de audio"} ${i + 1}`}</SelectItem>)}</SelectContent></Select>
      </div>;
    })}
    {!devices.some((d) => d.label) && <Button variant="outline" size="sm" className="w-full" disabled={busy} onClick={() => void refresh(true)}>Permitir acceso al audio</Button>}
    {!outputSupported && <p className="text-xs text-muted-foreground">Este navegador usa la salida elegida en el dispositivo. El altavoz y Bluetooth se cambian desde sus controles de audio.</p>}
    {error && <p role="alert" className="text-xs text-muted-foreground">{error}</p>}
  </section>;
}