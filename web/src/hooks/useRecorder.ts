import { useCallback, useEffect, useRef, useState } from "react";

const BARS = 48;
const SAMPLE_MS = 80;

export interface Recorder {
  isRecording: boolean;
  seconds: number;
  /** Recent loudness, 0..1, oldest first; drives the live waveform. */
  levels: number[];
  error: string;
  start: () => Promise<void>;
  /** Stop and hand the recording to `onComplete`. */
  stop: () => void;
  /** Stop and throw the recording away. */
  cancel: () => void;
}

function pickMimeType(): string {
  // Safari records mp4; Chrome and Firefox record webm. Both are accepted by the engine.
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function useRecorder(onComplete: (file: File) => void): Recorder {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [error, setError] = useState("");

  const recorder = useRef<MediaRecorder | null>(null);
  const cleanup = useRef<() => void>(() => {});
  const keep = useRef(true);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => () => cleanup.current(), []);

  const start = useCallback(async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record audio. You can still upload a voice note.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was blocked. Allow it in your browser, or upload a voice note instead.");
      return;
    }

    const mimeType = pickMimeType();
    // 32 kbps is plenty for speech and keeps a 15-minute recording under 4 MB.
    const media = new MediaRecorder(stream, { audioBitsPerSecond: 32_000, ...(mimeType ? { mimeType } : {}) });
    const chunks: Blob[] = [];
    media.addEventListener("dataavailable", (e) => e.data.size > 0 && chunks.push(e.data));
    media.addEventListener("stop", () => {
      cleanup.current();
      if (!keep.current) return;
      const type = media.mimeType || mimeType || "audio/webm";
      const ext = type.includes("mp4") ? "m4a" : "webm";
      onCompleteRef.current(new File(chunks, `recording.${ext}`, { type }));
    });

    // Loudness for the waveform: RMS of the time-domain signal, sampled a few times a second.
    const audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    audio.createMediaStreamSource(stream).connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    const sampler = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      const rms = Math.sqrt(buffer.reduce((sum, v) => sum + v * v, 0) / buffer.length);
      const level = Math.min(1, rms * 6);
      setLevels((prev) => [...prev.slice(1), level]);
    }, SAMPLE_MS);
    const startedAt = Date.now();
    const clock = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);

    cleanup.current = () => {
      window.clearInterval(sampler);
      window.clearInterval(clock);
      stream.getTracks().forEach((t) => t.stop());
      void audio.close().catch(() => {});
      cleanup.current = () => {};
    };

    keep.current = true;
    recorder.current = media;
    media.start();
    setSeconds(0);
    setLevels(Array(BARS).fill(0));
    setIsRecording(true);
  }, []);

  const finish = useCallback((keepRecording: boolean) => {
    keep.current = keepRecording;
    if (recorder.current?.state === "recording") recorder.current.stop();
    else cleanup.current();
    recorder.current = null;
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    seconds,
    levels,
    error,
    start,
    stop: useCallback(() => finish(true), [finish]),
    cancel: useCallback(() => finish(false), [finish]),
  };
}
