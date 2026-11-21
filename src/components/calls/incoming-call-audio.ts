/** Local ring and Spanish speech; no call audio is routed through this controller. */
let context: AudioContext | undefined;
export async function unlockIncomingAudio(): Promise<boolean> {
  try {
    context ??= new AudioContext();
    await context.resume();
    return context.state === "running";
  } catch { return false; }
}
export function playIncomingAlert(repeat: boolean): { stop: () => void; audible: boolean } {
  let stopped = false;
  const nodes: OscillatorNode[] = [];
  const ring = () => {
    if (stopped || context?.state !== "running") return;
    const start = context.currentTime;
    for (const delay of [0, 0.65]) {
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, start + delay);
      gain.gain.linearRampToValueAtTime(0.08, start + delay + 0.03);
      gain.gain.setValueAtTime(0.08, start + delay + 0.4);
      gain.gain.linearRampToValueAtTime(0, start + delay + 0.45);
      gain.connect(context.destination);
      for (const frequency of [440, 480]) {
        const oscillator = context.createOscillator();
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start(start + delay);
        oscillator.stop(start + delay + 0.5);
        nodes.push(oscillator);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
    }
  };
  ring();
  const voiceTimer = window.setTimeout(() => {
    if (stopped || context?.state !== "running" || !("speechSynthesis" in window)) return;
    const message = new SpeechSynthesisUtterance("Llamada entrante en Walix");
    message.lang = "es-MX";
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang === "es-MX") ?? voices.find(v => v.lang.startsWith("es"));
    if (voice) message.voice = voice;
    speechSynthesis.speak(message);
  }, 1300);
  const interval = repeat ? window.setInterval(ring, 6000) : undefined;
  const stop = () => {
    stopped = true; window.clearTimeout(voiceTimer); window.clearInterval(interval);
    for (const node of nodes) { try { node.stop(); } catch { /* already ended */ } }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  };
  const end = window.setTimeout(stop, repeat ? 30000 : 5000);
  return { stop: () => { window.clearTimeout(end); stop(); }, audible: context?.state === "running" };
}