// Eval summaries written by `rcpy eval run` (engine/evals/results/*.json),
// bundled at build time so the results page needs no API.

export interface Metrics {
  ingredient_f1: number | null;
  ingredient_precision: number | null;
  ingredient_recall: number | null;
  quantity_accuracy: number | null;
  ingredient_exact: number | null;
  step_recall: number | null;
  step_precision: number | null;
  metadata_accuracy: number | null;
  metadata_invented: number;
  uncertain_recall: number | null;
  uncertain_precision: number | null;
  error_rate: number | null;
}

export interface Summary {
  run_id: string;
  strategy: string;
  model: string;
  demo_mode: boolean;
  created_at: string;
  repeats: number;
  cases: string[];
  predictions: number;
  metrics: Metrics;
  spread: Partial<Record<keyof Metrics, number | null>>;
  by_tag: Record<string, Metrics>;
  per_case: {
    case_id: string;
    repeat: number;
    error: string | null;
    missing: string[];
    extra: string[];
    wrong_quantity: string[];
  }[];
  performance: {
    seconds_mean: number | null;
    seconds_p95: number | null;
    calls_per_recipe: number | null;
    input_tokens_mean: number | null;
    output_tokens_mean: number | null;
    cost_usd_mean: number | null;
  };
}

/** The strategy the engine ships by default; highlighted in the results table. */
export const SHIPPED = "staged-lite";
/** Columns of the comparison, in display order. */
export const STRATEGIES = [
  { id: "single", label: "One call" },
  { id: "staged-lite", label: "Transcribe → extract" },
  { id: "staged", label: "+ verify pass" },
];

const files = import.meta.glob<Summary>("../../../engine/evals/results/*.json", { eager: true, import: "default" });

/** The newest real (non-demo) run per strategy. */
export const latest: Record<string, Summary> = {};
for (const summary of Object.values(files)) {
  if (summary.demo_mode) continue;
  const current = latest[summary.strategy];
  if (!current || summary.created_at > current.created_at) latest[summary.strategy] = summary;
}

export const headline: Summary | undefined = latest[SHIPPED];

export function pct(value: number | null | undefined): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}
