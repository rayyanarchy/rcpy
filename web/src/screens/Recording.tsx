import type { Recorder } from "../hooks/useRecorder";
import { formatClock } from "../lib/format";
import { Header } from "../ui/Header";
import "./Recording.css";

export function Recording({ recorder }: { recorder: Recorder }) {
  return (
    <div className="recording">
      <Header>
        <button type="button" className="button button--quiet" onClick={recorder.cancel}>
          Cancel
        </button>
      </Header>
      <main className="recording__body page">
        <div className="recording__status">
          <span className="recording__dot" aria-hidden />
          Listening
        </div>
        <div className="recording__clock mono" role="timer" aria-live="off">
          {formatClock(recorder.seconds)}
        </div>
        <div className="recording__wave" aria-hidden>
          {recorder.levels.map((level, i) => (
            <span key={i} style={{ height: `${4 + level * 88}px` }} />
          ))}
        </div>
        <p className="recording__hint">Say the amounts as you go. If you get one wrong, just say the right one.</p>
      </main>
      <footer className="recording__controls">
        <button type="button" className="recording__stop" onClick={recorder.stop} aria-describedby="stop-label">
          <span aria-hidden />
          <span className="visually-hidden">Stop</span>
        </button>
        <span id="stop-label">Stop and create recipe</span>
      </footer>
    </div>
  );
}
