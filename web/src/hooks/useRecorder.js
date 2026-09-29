import { useEffect, useRef, useState } from "react";

export function useRecorder(onComplete) {
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  const start = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("This browser does not support microphone recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: preferredType });
      recorderRef.current = recorder;
      streamRef.current = stream;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, { type: preferredType });
        const file = new File([blob], "dictated-recipe.webm", {
          type: preferredType
        });
        stream.getTracks().forEach((track) => track.stop());
        onComplete(file);
      });

      recorder.start();
      setSeconds(0);
      setIsRecording(true);
      timerRef.current = setInterval(
        () => setSeconds((value) => value + 1),
        1000
      );
    } catch {
      setError("Microphone access was blocked. You can still upload a file.");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  return { isRecording, seconds, error, start, stop };
}
