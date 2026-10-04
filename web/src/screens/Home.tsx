import { Mic, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { headline, pct } from "../lib/results";
import { Header, MainNav } from "../ui/Header";
import { Link } from "../ui/Link";
import "./Home.css";

// Hosts cap request bodies (Vercel: 4.5 MB), so deployments can lower this at build time.
const MAX_MB = Number(import.meta.env.VITE_MAX_AUDIO_MB) || 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ACCEPT = ".m4a,.mp3,.mp4,.wav,.webm,.ogg,.opus,.flac,.aac,audio/*";

// A real recording (engine/data/raw/chatpate_aloo.mp3), trimmed.
const SPECIMEN = [
  { qty: "0.5 kg", name: "potatoes", alias: "aloo" },
  { qty: "15–20", name: "garlic cloves", alias: "lasun" },
  { qty: "1 tsp", name: "cumin seeds", alias: "jeera" },
  { qty: "to taste", name: "turmeric", alias: "haldi" },
];

interface Props {
  onRecord: () => void;
  onFile: (file: File) => void;
  error: string;
}

export function Home({ onRecord, onFile, error }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState("");

  const accept = (file: File | undefined) => {
    setLocalError("");
    if (!file) return;
    if (file.size > MAX_BYTES) return setLocalError(`That file is over ${MAX_MB} MB. Try a shorter recording.`);
    onFile(file);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files[0]);
  };

  const message = localError || error;

  return (
    <div className="home">
      <Header>
        <MainNav />
      </Header>

      <main className="page">
        <section className="home__hero" aria-labelledby="hero">
          <h1 id="hero" className="display home__title">
            <span>Dictate recipes</span>
            <span className="home__title-line">
              into <img src="/crouton_icon.png" alt="" className="home__crouton" /> Crouton.
            </span>
          </h1>
          <p className="home__lede">
            Talk through a recipe the way you would tell family, in English, Hindi or Urdu, mixed however it comes out.
            RCPY writes it down as a recipe you can check before it goes anywhere.
          </p>
        </section>

        <section
          className={`home__panel${dragging ? " is-dragging" : ""}`}
          aria-label="Add a recording"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={onDrop}
        >
          <div className="home__option">
            <button type="button" className="home__record" onClick={onRecord} aria-describedby="record-help">
              <Mic size={30} strokeWidth={1.8} aria-hidden />
              <span className="visually-hidden">Start recording</span>
            </button>
            <div>
              <div className="home__option-title">Record</div>
              <p id="record-help" className="home__option-help">
                Tap and start talking. Say amounts as you go; corrections like "two, no, three" are fine.
              </p>
            </div>
          </div>
          <div className="home__option">
            <button type="button" className="home__upload" onClick={() => input.current?.click()}>
              <Upload size={28} strokeWidth={1.6} aria-hidden />
              <span className="visually-hidden">Choose an audio file</span>
            </button>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={(e) => {
                accept(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div>
              <div className="home__option-title">{dragging ? "Drop it here" : "Drop a voice note"}</div>
              <p className="home__option-help mono home__formats">
                m4a · mp3 · wav · webm · ogg · flac · up to {MAX_MB} MB
              </p>
            </div>
          </div>
        </section>
        {message && (
          <p className="error home__error" role="alert">
            {message}
          </p>
        )}

        <section className="home__specimen" aria-labelledby="specimen">
          <h2 id="specimen" className="eyebrow">
            A real recording, start to finish
          </h2>
          <div className="home__columns">
            <div className="home__column">
              <div className="home__step mono">01 · What was said</div>
              <p className="home__quote">
                "…adha kilo aloo ko paani mein bhigne rakhenge, uske baad 15 20 lasun ki kali, ek teaspoon jeera…"
              </p>
            </div>
            <div className="home__column">
              <div className="home__step mono">02 · What RCPY heard</div>
              <p className="home__heard">
                Soak <mark>half a kilo of potatoes</mark> in water. Then crush <mark>15 to 20 garlic cloves</mark> with{" "}
                <mark>one teaspoon of cumin</mark> in a mixer jar.
              </p>
            </div>
            <div className="home__column">
              <div className="home__step mono">03 · What you get</div>
              <ul className="home__rows">
                {SPECIMEN.map((row) => (
                  <li key={row.name}>
                    <span className="mono">{row.qty}</span>
                    <span>
                      {row.name} <span className="muted">({row.alias})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="page">
        <div className="home__footer">
          <span>Audio is deleted after processing. Shared links expire after an hour.</span>
          <Link to="/how-it-works" className="home__proof">
            {headline
              ? `Ingredient F1 ${pct(headline.metrics.ingredient_f1)} on ${headline.cases.length} dictated recipes →`
              : "How it works →"}
          </Link>
        </div>
      </footer>
    </div>
  );
}
