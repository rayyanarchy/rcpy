import { useEffect, useRef, useState } from "react";
import { useRecorder } from "./hooks/useRecorder";
import { ApiError, processAudio } from "./lib/api";
import { audioDuration } from "./lib/format";
import { usePath } from "./lib/router";
import type { RecipeDraft } from "./lib/types";
import { Home } from "./screens/Home";
import { HowItWorks } from "./screens/HowItWorks";
import { Processing, type Progress } from "./screens/Processing";
import { Recording } from "./screens/Recording";
import { Review } from "./screens/Review";

const DRAFT_KEY = "rcpy:draft";

// The draft survives a reload in this browser only; storage can be unavailable (private mode).
function loadDraft(): RecipeDraft | null {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    return saved ? (JSON.parse(saved) as RecipeDraft) : null;
  } catch {
    return null;
  }
}

function saveDraft(draft: RecipeDraft | null) {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to do: the draft just won't survive a reload.
  }
}

interface Job {
  file: File;
  duration: number | null;
  progress: Progress;
}

export default function App() {
  const path = usePath();
  return path === "/how-it-works" ? <HowItWorks /> : <Flow />;
}

function Flow() {
  const [draft, setDraft] = useState<RecipeDraft | null>(loadDraft);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const recorder = useRecorder((file) => void process(file, recorder.seconds));

  useEffect(() => saveDraft(draft), [draft]);

  useEffect(() => {
    document.title = draft ? `${draft.name || "Recipe"} · RCPY` : "RCPY · Dictate recipes into Crouton";
  }, [draft]);

  async function process(file: File, recordedSeconds?: number) {
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    setJob({ file, duration: recordedSeconds ?? null, progress: { plan: [], stages: {} } });
    if (recordedSeconds == null) {
      void audioDuration(file).then((duration) => setJob((j) => (j && j.file === file ? { ...j, duration } : j)));
    }

    const update = (fn: (p: Progress) => Progress) =>
      setJob((j) => (j && j.file === file ? { ...j, progress: fn(j.progress) } : j));

    try {
      const result = await processAudio(
        file,
        (event) => {
          if (event.event === "plan") update((p) => ({ ...p, plan: event.stages }));
          else if (event.event === "stage")
            update((p) => ({
              ...p,
              stages: {
                ...p.stages,
                [event.name]: { status: event.status === "start" ? "active" : "done", seconds: event.seconds },
              },
            }));
          else if (event.event === "transcript") update((p) => ({ ...p, transcript: event }));
        },
        controller.signal,
      );
      setDraft(result);
      window.scrollTo(0, 0);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.");
    } finally {
      if (abort.current === controller) {
        abort.current = null;
        setJob(null);
      }
    }
  }

  const cancel = () => {
    abort.current?.abort();
    abort.current = null;
    setJob(null);
  };

  if (recorder.isRecording) return <Recording recorder={recorder} />;
  if (job) return <Processing file={job.file} duration={job.duration} progress={job.progress} onCancel={cancel} />;
  if (draft)
    return (
      <Review
        draft={draft}
        onChange={setDraft}
        onStartOver={() => {
          setDraft(null);
          setError("");
        }}
      />
    );
  return (
    <Home
      onRecord={() => void recorder.start()}
      onFile={(file) => void process(file)}
      error={error || recorder.error}
    />
  );
}
