import { expect, it, vi } from "vitest";
import { applyCallAudio } from "./CallAudioControls";

it("routes the selected microphone and speaker through the call audio engine", async () => {
  const audio = { isOutputSelectionSupported: true, setInputDevice: vi.fn(), speakerDevices: { set: vi.fn() } };
  await applyCallAudio(audio, { input: "bluetooth-mic", output: "headphones" });
  expect(audio.setInputDevice).toHaveBeenCalledWith("bluetooth-mic");
  expect(audio.speakerDevices.set).toHaveBeenCalledWith("headphones");
});
it("does not attempt unsupported speaker routing or acquire a default mic early", async () => {
  const audio = { isOutputSelectionSupported: false, setInputDevice: vi.fn(), speakerDevices: { set: vi.fn() } };
  await applyCallAudio(audio, { input: "default", output: "default" });
  expect(audio.setInputDevice).not.toHaveBeenCalled();
  expect(audio.speakerDevices.set).not.toHaveBeenCalled();
});