import type {} from "./generated/ai-gateway/models.d.ts";
import { transcribeAudio } from "npm:@lovable.dev/ai-gateway@0.1.13";
import { recordAiUsage } from "./ai-usage.ts";
import { decryptCredentials } from "./telephony-creds.ts";
import { analyzeCall } from "./call-analyzer.ts";

export async function transcribeRecording(admin: any, channel: any, callId: string, recordingSid: string) {
  if (!/^RE[a-fA-F0-9]{32}$/.test(recordingSid)) throw new Error("Grabación inválida");
  const { data: claimed, error } = await admin.from("calls").update({ transcript: "", ai_suggestions: { transcription_status: "processing" } })
    .eq("id", callId).eq("tenant_id", channel.tenant_id).is("transcript", null).select("id,user_id").maybeSingle();
  if (error) throw error;
  if (!claimed) return;
  try {
    const creds = await decryptCredentials(channel.credentials_encrypted);
    // Construct the provider URL; never fetch a callback-supplied URL.
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}/Recordings/${recordingSid}.mp3`, {
      headers: { Authorization: "Basic " + btoa(`${creds.api_key_sid}:${creds.api_key_secret}`) }, redirect: "error",
    });
    if (!response.ok) throw new Error(`No se pudo descargar la grabación (${response.status})`);
    const audio = await response.blob();
    if (audio.size > 25 * 1024 * 1024) throw new Error("La grabación excede el tamaño permitido para transcripción");
    const result = await transcribeAudio({ model: "openai/gpt-transcribe", file: audio, language: "es" });
    const text = typeof result === "string" ? result : result.text;
    await recordAiUsage({ tenantId: channel.tenant_id, userId: claimed.user_id, surface: "call_transcription", model: "openai/gpt-transcribe", charge: false });
    const analysis = await analyzeCall(admin, callId, text);
    if (!analysis.ok && analysis.status !== 409) {
      const { data: latest } = await admin.from("calls").select("ai_suggestions").eq("id", callId).maybeSingle();
      await admin.from("calls").update({ transcript: text, ai_suggestions: { ...latest?.ai_suggestions,
        transcription_status: "completed", analysis_error: analysis.error } }).eq("id", callId);
    }
  } catch {
    // Do not replay inference automatically: it may already have been billed.
    await admin.from("calls").update({ ai_suggestions: { transcription_status: "failed", transcription_error: "No se pudo transcribir; la grabación se conservó." } }).eq("id", callId);
  }
}