import { useState } from "react";
import { type Metrics, type Summary, SHIPPED, STRATEGIES, headline, latest, pct } from "../lib/results";
import { Header, MainNav } from "../ui/Header";
import { Link } from "../ui/Link";
import "./HowItWorks.css";

const PIPELINE = [
  ["01 · audio in", "Transcribe", "Word for word in the language spoken, plus a faithful English translation."],
  ["02 · text in", "Extract", "Ingredients, amounts, units and steps. Knows pav, katori and chammach."],
  ["03 · you", "Review", "Anything the model was unsure about is marked for you to check."],
];

// What the comparison showed, in words. Numbers live in the table above it.
const FINDINGS = [
  [
    "Separating listening from understanding pays off.",
    "Across all 36 recipes, transcribing first and extracting from the text roughly halved wrong amounts and made-up servings or times compared with one call, for about half a second more.",
  ],
  [
    "A third, verify stage was tested and left out.",
    "Re-reading the transcript cut made-up details a little further, but it was about 50% slower, nearly twice the cost, and condensed the method, dropping spoken detail.",
  ],
  [
    "Read-aloud speech is the easy case.",
    "The recipes were read from scripts with mistakes written in. Spontaneous recordings are next, to see how far these numbers carry over.",
  ],
];

type Row = { name: string; help: string; value: (m: Metrics, s: Summary) => string; key?: keyof Metrics };

const ROWS: Row[] = [
  {
    name: "Ingredient F1",
    help: "Found the right ingredients, without inventing any",
    key: "ingredient_f1",
    value: (m) => pct(m.ingredient_f1),
  },
  {
    name: "Quantity accuracy",
    help: "Right amount and unit, after conversion",
    key: "quantity_accuracy",
    value: (m) => pct(m.quantity_accuracy),
  },
  {
    name: "Ingredient exact",
    help: "Found and right quantity, end to end",
    key: "ingredient_exact",
    value: (m) => pct(m.ingredient_exact),
  },
  {
    name: "Step coverage",
    help: "How much of what was said made it into the steps",
    key: "step_recall",
    value: (m) => pct(m.step_recall),
  },
  {
    name: "Invented servings or times",
    help: "Values that were never spoken",
    value: (m) => String(m.metadata_invented),
  },
  {
    name: "Errors flagged for review",
    help: "Wrong rows the app highlighted",
    key: "uncertain_recall",
    value: (m) => pct(m.uncertain_recall),
  },
  {
    name: "Latency · model calls",
    help: "Per recipe, all stages together",
    value: (_, s) =>
      s.performance.seconds_mean == null
        ? "—"
        : `${s.performance.seconds_mean.toFixed(1)}s · ${s.performance.calls_per_recipe ?? "—"}`,
  },
];

type Failure = { tag: string; case: string; text: string };

/**
 * A few real mistakes of the shipped strategy for the results page: ones that
 * happened in at least two of the repeated runs (so not a fluke), at most one per
 * recipe, wrong amounts before missed ingredients.
 */
function recurringFailures(summary: Summary | undefined): Failure[] {
  if (!summary) return [];
  const counts = new Map<string, { failure: Failure; n: number; rank: number }>();
  const add = (failure: Failure, rank: number) => {
    const key = `${failure.case}|${failure.text}`;
    const seen = counts.get(key);
    counts.set(key, { failure, rank, n: (seen?.n ?? 0) + 1 });
  };
  for (const c of summary.per_case) {
    for (const q of c.wrong_quantity) {
      const [name, rest = ""] = q.split(": expected ");
      const [said, got] = rest.split(", got ");
      add(
        {
          tag: "wrong amount",
          case: c.case_id,
          text: `${name}: said ${said}, came back as ${got}.`.replace(/ item\b/g, ""),
        },
        0,
      );
    }
    for (const name of c.missing) add({ tag: "missed", case: c.case_id, text: `Missed “${name}”.` }, 1);
  }
  const perCase = new Set<string>();
  return [...counts.values()]
    .filter((x) => x.n >= Math.min(2, summary.repeats))
    .sort((a, b) => a.rank - b.rank || b.n - a.n)
    .map((x) => x.failure)
    .filter((f) => !perCase.has(f.case) && perCase.add(f.case))
    .slice(0, 6);
}

export function HowItWorks() {
  const hasHoldout = Object.values(latest).some((s) => s.by_tag.holdout);
  const [scope, setScope] = useState<"all" | "holdout">(hasHoldout ? "holdout" : "all");
  const metricsFor = (s: Summary) => (scope === "holdout" ? s.by_tag.holdout : s.metrics);

  const failures = recurringFailures(headline);

  return (
    <div className="how">
      <Header>
        <MainNav />
      </Header>
      <main className="page">
        <section className="how__intro" aria-labelledby="how-title">
          <p className="mono how__kicker">How it works</p>
          <h1 id="how-title" className="display how__title">
            Two small jobs instead of one big guess
          </h1>
          <p className="how__lede">
            Family recipes are spoken in a mix of languages, with amounts like "thoda sa" and corrections halfway
            through a sentence. RCPY listens first and reads second, and every choice in that pipeline was measured on
            recipes dictated by family.
          </p>
        </section>

        <ol className="how__pipeline" aria-label="Pipeline">
          {PIPELINE.map(([n, name, detail], i) => (
            <li key={name} className={i === PIPELINE.length - 1 ? "is-you" : ""}>
              <span className="mono how__n">{n}</span>
              <span className="how__stage">{name}</span>
              <span className="how__detail">{detail}</span>
            </li>
          ))}
        </ol>

        <section className="how__section" aria-labelledby="results">
          <div className="how__section-head">
            <h2 id="results">Results</h2>
            {headline && (
              <span className="mono how__meta">
                {headline.cases.length} dictated recipes · {headline.repeats} run
                {headline.repeats > 1 ? "s" : ""} each · {headline.model}
              </span>
            )}
          </div>

          {headline ? (
            <>
              {hasHoldout && (
                <div className="segmented how__scope" role="group" aria-label="Which recordings">
                  <button type="button" aria-pressed={scope === "holdout"} onClick={() => setScope("holdout")}>
                    Held-out set
                  </button>
                  <button type="button" aria-pressed={scope === "all"} onClick={() => setScope("all")}>
                    All recordings
                  </button>
                </div>
              )}
              <div className="how__table-wrap">
                <table className="how__table">
                  <thead>
                    <tr>
                      <th scope="col">Metric</th>
                      {STRATEGIES.map((s) => (
                        <th key={s.id} scope="col" className={s.id === SHIPPED ? "is-shipped" : ""}>
                          {s.label}
                          {s.id === SHIPPED && <span className="how__shipped"> (shipped)</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row) => (
                      <tr key={row.name}>
                        <th scope="row">
                          {row.name}
                          <span>{row.help}</span>
                        </th>
                        {STRATEGIES.map((s) => {
                          const summary = latest[s.id];
                          const metrics = summary && metricsFor(summary);
                          const sd = row.key && scope === "all" ? summary?.spread[row.key] : null;
                          return (
                            <td key={s.id} className={`mono${s.id === SHIPPED ? " is-shipped" : ""}`}>
                              {summary && metrics ? row.value(metrics, summary) : "—"}
                              {sd != null && sd > 0 && <span className="how__sd"> ±{(sd * 100).toFixed(1)}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="how__findings">
                {FINDINGS.map(([title, text]) => (
                  <li key={title}>
                    <strong>{title}</strong> {text}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="how__empty">
              The eval set is being recorded: real family recipes, checked by hand. Numbers appear here after the first
              run.
            </p>
          )}
          <p className="how__method">
            Scoring is deterministic. Ingredients are matched by name, with a Hindi/Urdu synonym table; quantities are
            compared after unit conversion; spoken ranges accept any value inside them.{" "}
            <a href="https://github.com/rayyanarchy/rcpy/tree/main/engine/evals">Read the method and every run</a>.
          </p>
        </section>

        {failures.length > 0 && (
          <section className="how__section" aria-labelledby="failures">
            <div className="how__section-head">
              <h2 id="failures">Where it still goes wrong</h2>
            </div>
            <ul className="how__failures">
              {failures.map((f, i) => (
                <li key={i}>
                  <span className="mono how__n">
                    {f.tag} · {f.case}
                  </span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="how__cta">
          <Link to="/" className="button button--primary">
            Try it with a recording
          </Link>
        </section>
      </main>
    </div>
  );
}
