import { Plus, X } from "lucide-react";
import { useState } from "react";
import { parseQuantity } from "../lib/quantity";
import type { Ingredient, RecipeDraft, Step } from "../lib/types";
import { AutoTextarea } from "../ui/AutoTextarea";
import { Header } from "../ui/Header";
import { ExportPanel } from "./ExportPanel";
import "./Review.css";

interface Props {
  draft: RecipeDraft;
  onChange: (draft: RecipeDraft) => void;
  onStartOver: () => void;
}

const META = [
  { key: "servings", label: "Servings", min: 1 },
  { key: "prepMinutes", label: "Prep (min)", min: 0 },
  { key: "cookMinutes", label: "Cook (min)", min: 0 },
] as const;

export function Review({ draft, onChange, onStartOver }: Props) {
  const set = <K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) => onChange({ ...draft, [key]: value });

  const setIngredient = (id: string, patch: Partial<Ingredient>) =>
    set(
      "ingredients",
      draft.ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  const setStep = (id: string, patch: Partial<Step>) =>
    set(
      "steps",
      draft.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );

  const toCheck = draft.ingredients.filter((i) => i.uncertain).length + draft.steps.filter((s) => s.uncertain).length;

  return (
    <div className="review">
      <Header>
        <button type="button" className="button button--quiet" onClick={onStartOver}>
          Start over
        </button>
      </Header>

      <main className="page">
        <section className="review__intro" aria-label="Recipe">
          <div className="mono review__meta">Spoken in {draft.sourceLanguage}</div>
          <label className="visually-hidden" htmlFor="recipe-name">
            Recipe name
          </label>
          <AutoTextarea
            id="recipe-name"
            className="display review__name"
            value={draft.name}
            onChange={(e) => set("name", e.target.value.replace(/\n/g, " "))}
          />
          <label className="visually-hidden" htmlFor="recipe-description">
            Description
          </label>
          <AutoTextarea
            id="recipe-description"
            className="review__description"
            value={draft.description}
            placeholder="Add a short description"
            onChange={(e) => set("description", e.target.value)}
          />
          <div className="review__facts">
            {META.map(({ key, label, min }) => (
              <label key={key} className="review__fact">
                {label}
                <input
                  type="number"
                  inputMode="numeric"
                  min={min}
                  className="mono"
                  value={draft[key] ?? ""}
                  placeholder="not said"
                  onChange={(e) => set(key, e.target.value === "" ? null : Math.max(min, Number(e.target.value)))}
                />
              </label>
            ))}
          </div>
        </section>

        <div className="review__grid">
          <div className="review__content">
            <section aria-labelledby="ingredients">
              <div className="review__heading">
                <h2 id="ingredients">Ingredients</h2>
                {toCheck > 0 && <span className="review__to-check">{toCheck} to check</span>}
              </div>
              <ul className="review__list">
                {draft.ingredients.map((item) => (
                  <li key={item.id} className="review__ingredient">
                    <input
                      aria-label={`Amount of ${item.name || "ingredient"}`}
                      className="mono review__qty"
                      value={item.quantity}
                      placeholder="amount"
                      onChange={(e) =>
                        setIngredient(item.id, { quantity: e.target.value, ...parseQuantity(e.target.value), uncertain: false })
                      }
                    />
                    <input
                      aria-label="Ingredient"
                      value={item.name}
                      placeholder="ingredient"
                      onChange={(e) => setIngredient(item.id, { name: e.target.value, uncertain: false })}
                    />
                    <RowEnd
                      uncertain={item.uncertain}
                      onConfirm={() => setIngredient(item.id, { uncertain: false })}
                      onRemove={() => set("ingredients", draft.ingredients.filter((i) => i.id !== item.id))}
                      what={item.name || "ingredient"}
                      canRemove={draft.ingredients.length > 1}
                    />
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="button button--quiet review__add"
                onClick={() =>
                  set("ingredients", [
                    ...draft.ingredients,
                    { id: crypto.randomUUID(), quantity: "", amount: null, unit: "ITEM", name: "", uncertain: false },
                  ])
                }
              >
                <Plus size={16} aria-hidden /> Add ingredient
              </button>
            </section>

            <section aria-labelledby="steps">
              <div className="review__heading">
                <h2 id="steps">Steps</h2>
              </div>
              <ol className="review__list">
                {draft.steps.map((step, n) => (
                  <li key={step.id} className="review__step">
                    <span className="mono review__number" aria-hidden>
                      {String(n + 1).padStart(2, "0")}
                    </span>
                    <AutoTextarea
                      aria-label={`Step ${n + 1}`}
                      value={step.text}
                      onChange={(e) => setStep(step.id, { text: e.target.value, uncertain: false })}
                    />
                    <RowEnd
                      uncertain={step.uncertain}
                      onConfirm={() => setStep(step.id, { uncertain: false })}
                      onRemove={() => set("steps", draft.steps.filter((s) => s.id !== step.id))}
                      what={`step ${n + 1}`}
                      canRemove={draft.steps.length > 1}
                    />
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="button button--quiet review__add"
                onClick={() => set("steps", [...draft.steps, { id: crypto.randomUUID(), text: "", uncertain: false }])}
              >
                <Plus size={16} aria-hidden /> Add step
              </button>
            </section>

            {draft.notes.length > 0 && (
              <section aria-labelledby="notes">
                <div className="review__heading">
                  <h2 id="notes">Notes</h2>
                </div>
                <ul className="review__notes">
                  {draft.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="review__aside">
            <TranscriptPanel draft={draft} />
            <ExportPanel draft={draft} />
          </aside>
        </div>
      </main>
    </div>
  );
}

function RowEnd(props: {
  uncertain: boolean;
  onConfirm: () => void;
  onRemove: () => void;
  what: string;
  canRemove: boolean;
}) {
  return (
    <span className="review__row-end">
      {props.uncertain && (
        <button
          type="button"
          className="review__check"
          onClick={props.onConfirm}
          title="RCPY wasn't sure about this. Fix it, or click to mark it as right."
        >
          <span aria-hidden />
          check<span className="visually-hidden">: mark {props.what} as right</span>
        </button>
      )}
      {props.canRemove && (
        <button type="button" className="review__remove" onClick={props.onRemove} aria-label={`Remove ${props.what}`}>
          <X size={16} aria-hidden />
        </button>
      )}
    </span>
  );
}

function TranscriptPanel({ draft }: { draft: RecipeDraft }) {
  const hasOriginal = draft.originalTranscript.trim() !== draft.englishTranscript.trim();
  const [view, setView] = useState<"original" | "english">("original");
  const text = view === "original" && hasOriginal ? draft.originalTranscript : draft.englishTranscript;
  return (
    <section className="panel" aria-labelledby="transcript">
      <div className="panel__head">
        <h2 id="transcript" className="eyebrow">
          What was said
        </h2>
        {hasOriginal && (
          <div className="segmented" role="group" aria-label="Transcript language">
            <button type="button" aria-pressed={view === "original"} onClick={() => setView("original")}>
              Original
            </button>
            <button type="button" aria-pressed={view === "english"} onClick={() => setView("english")}>
              English
            </button>
          </div>
        )}
      </div>
      <p className="panel__transcript">{text}</p>
    </section>
  );
}
