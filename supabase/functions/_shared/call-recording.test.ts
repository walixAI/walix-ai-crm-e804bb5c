import { describe, it, expect } from "vitest";
import { isRecordingDownloadable, recordingFileName } from "./call-recording";
describe("grabaciones", () => {
  it("no permite descargar si no hubo conversación", () => {
    expect(isRecordingDownloadable({ recording_url: "x", duration_seconds: 0, answered_at: null })).toBe(false);
  });
  it("no permite descargar sin grabación", () => {
    expect(isRecordingDownloadable({ recording_url: null, duration_seconds: 40 })).toBe(false);
  });
  it("no permite descargar mensajes de buzón", () => {
    expect(isRecordingDownloadable({ recording_url: "x", answered_at: "2026-11-21T16:00:00Z", status: "voicemail" })).toBe(false);
  });
  it("permite descargar una llamada efectiva con grabación", () => {
    expect(isRecordingDownloadable({ recording_url: "x", duration_seconds: 43 })).toBe(true);
  });
  it("nombra el archivo con contacto y fecha en hora de México", () => {
    expect(recordingFileName("José Pérez", "2026-11-21T16:05:00Z")).toBe("llamada_jose-perez_2026-11-21_1005.mp3");
  });
});
