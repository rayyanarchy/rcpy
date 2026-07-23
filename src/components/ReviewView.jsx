import { LoaderCircle, Save } from "lucide-react";
import { RecipeEditor } from "./RecipeEditor.jsx";

export function ReviewView({
  draft,
  onChange,
  onPublish,
  onSaveDraft,
  isPublishing,
  error,
  saved,
  isPublished
}) {
  return (
    <main className="review-view">
      <section className="review-heading">
        <h1>Review the recipe before you share it.</h1>
        <p>
          We kept the original transcript beside the English recipe so
          uncertain details are easy to check.
        </p>
      </section>

      <div className="review-layout">
        <aside className="transcript-panel">
          <h2>Original transcript</h2>
          <span className="language-label">{draft.sourceLanguage}</span>
          <p>{draft.originalTranscript}</p>
          <details>
            <summary>English transcript</summary>
            <p>{draft.englishTranscript}</p>
          </details>
        </aside>
        <RecipeEditor draft={draft} onChange={onChange} />
      </div>

      {error && <div className="error-message review-error" role="alert">{error}</div>}

      <div className="action-rail">
        <button
          className="button button--primary"
          type="button"
          onClick={onPublish}
          disabled={isPublishing}
        >
          {isPublishing ? (
            <>
              <LoaderCircle className="spin" aria-hidden="true" />
              Publishing…
            </>
          ) : isPublished ? (
            "Update recipe"
          ) : (
            "Publish recipe"
          )}
        </button>
        <button
          className="button button--outline"
          type="button"
          onClick={onSaveDraft}
        >
          <Save aria-hidden="true" /> Save draft
        </button>
        <span>
          {saved ? "Draft saved in this browser." : "You can edit this again after publishing."}
        </span>
      </div>
    </main>
  );
}
