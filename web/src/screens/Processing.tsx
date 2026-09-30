import { Check } from "lucide-react";
import { formatClock, formatMegabytes } from "../lib/format";
import { Header } from "../ui/Header";
import "./Processing.css";

export interface StageState {
  status: "pending" | "active" | "done";
  seconds?: number;
}

export interface Progress {
  plan: string[];
  stages: Record<string, StageState>;
  transcript?: { sourceLanguage: string; originalTranscript: string; englishTranscript: string };
}

const LABELS: Record<string, [string, string]> = {
  single: ["Read the recording", "Transcribe and extract in one pass"],
  transcribe: ["Transcribe", "Word for word, in the language spoken"],
  extract: ["Extract", "Ingredients, amounts and steps"],
  verify: ["Verify", "Checks every amount against the transcript"],
};

interface Props {
  file: File;
  duration: number | null;
  progress: Progress;
  onCancel: () => void;
}

export function Processing({ file, duration, progress, onCancel }: Props) {
  const { plan, stages, transcript } = progress;
  const meta = [file.name, duration != null && formatClock(duration), formatMegabytes(file.size)].filter(Boolean);

  return (
    <div className="processing">
      <Header>
        <button type="button" className="button button--quiet" onClick={onCancel}>
          Cancel
        </button>
      </Header>
      <main className="page">
        <section className="processing__intro">
          <div className="mono processing__meta">{meta.join(" · ")}</div>
          <h1 className="display processing__title">Reading your recipe</h1>
        </section>

        <div className="processing__grid">
          <ol className="processing__stages" aria-label="Progress">
            {plan.map((name) => {
              const state = stages[name] ?? { status: "pending" };
              const [label, detail] = LABELS[name] ?? [name, ""];
              return (
                <li key={name} className={`processing__stage is-${state.status}`}>
                  <span className="processing__dot" aria-hidden>
                    {state.status === "done" && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="processing__label">
                      {label}
                      <span className="visually-hidden">, {state.status}</span>
                    </span>
                    <span className="processing__detail">{detail}</span>
                  </span>
                  <span className="mono processing__time">
                    {state.status === "done" && state.seconds != null ? `${state.seconds.toFixed(1)}s` : ""}
                    {state.status === "active" ? "…" : ""}
                  </span>
                </li>
              );
            })}
          </ol>

          <section className="processing__panel" aria-labelledby="transcript-title" aria-live="polite">
            <h2 id="transcript-title" className="eyebrow">
              Transcript{transcript ? ` · ${transcript.sourceLanguage}` : ""}
            </h2>
            {transcript ? (
              <>
                <p className="processing__original">{transcript.originalTranscript}</p>
                {transcript.englishTranscript !== transcript.originalTranscript && (
                  <p className="processing__english">{transcript.englishTranscript}</p>
                )}
              </>
            ) : (
              <div className="processing__placeholder" aria-label="Listening to the recording">
                <span />
                <span />
                <span />
                <span />
              </div>
            )}
          </section>
        </div>

        <p className="processing__note">
          Usually 5 to 15 seconds. The audio is deleted from the server as soon as it has been read.
        </p>
      </main>
    </div>
  );
}
