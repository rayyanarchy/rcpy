import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  Languages,
  LoaderCircle,
  PenLine,
  Printer,
  Save,
  Share2
} from "lucide-react";
import { RecipeEditor } from "./RecipeEditor.jsx";
import { formatRecipeMarkdown, printRecipeCard, downloadBlob } from "../lib/export.js";

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
  const [activeTab, setActiveTab] = useState("editor"); // 'editor' | 'transcript'
  const [copiedMd, setCopiedMd] = useState(false);

  const handleCopyMarkdown = async () => {
    const md = formatRecipeMarkdown(draft);
    await navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const md = formatRecipeMarkdown(draft);
    const fileName =
      draft.name?.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "recipe";
    downloadBlob(md, `${fileName}.md`, "text/markdown;charset=utf-8");
  };

  const handlePrint = () => {
    printRecipeCard(draft);
  };

  return (
    <main className="review-view">
      <section className="review-heading">
        <div className="review-heading__meta">
          <span className="review-badge">Review &amp; Edit</span>
          {draft.sourceLanguage && (
            <span className="review-lang-tag">
              <Languages aria-hidden="true" size={14} /> Spoken in {draft.sourceLanguage}
            </span>
          )}
        </div>
        <h1>Fine-tune your recipe</h1>
        <p>
          Compare the extracted recipe with the original recording transcript.
          Edit any ingredient or step, then publish or export directly.
        </p>
      </section>

      {/* Mobile Tab Navigation */}
      <div className="review-mobile-tabs" role="tablist" aria-label="Review views">
        <button
          className={`review-mobile-tab ${activeTab === "editor" ? "is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "editor"}
          type="button"
          onClick={() => setActiveTab("editor")}
        >
          <PenLine aria-hidden="true" size={16} />
          <span>Recipe Editor</span>
        </button>
        <button
          className={`review-mobile-tab ${activeTab === "transcript" ? "is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "transcript"}
          type="button"
          onClick={() => setActiveTab("transcript")}
        >
          <Languages aria-hidden="true" size={16} />
          <span>Original Transcript ({draft.sourceLanguage || "Audio"})</span>
        </button>
      </div>

      <div className="review-layout">
        <aside
          className={`transcript-panel ${activeTab === "transcript" ? "is-active-tab" : "is-hidden-mobile"}`}
        >
          <div className="transcript-panel__header">
            <h2>Spoken Audio</h2>
            <span className="language-label">{draft.sourceLanguage}</span>
          </div>
          <p className="transcript-text">{draft.originalTranscript}</p>

          {draft.englishTranscript && (
            <details className="transcript-details" open>
              <summary>English translation</summary>
              <p>{draft.englishTranscript}</p>
            </details>
          )}

          <div className="transcript-hint">
            <small>
              Highlighted items in the editor indicate quantities or steps that may require verification against the recording.
            </small>
          </div>
        </aside>

        <div
          className={`editor-wrapper ${activeTab === "editor" ? "is-active-tab" : "is-hidden-mobile"}`}
        >
          <RecipeEditor draft={draft} onChange={onChange} />
        </div>
      </div>

      {error && (
        <div className="error-message review-error" role="alert">
          {error}
        </div>
      )}

      {/* Action Rail / Floating Toolbar */}
      <footer className="action-rail">
        <div className="action-rail__primary-group">
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
              "Update published recipe"
            ) : (
              <>
                <Share2 aria-hidden="true" size={17} />
                Publish &amp; Share
              </>
            )}
          </button>

          <button
            className="button button--outline"
            type="button"
            onClick={onSaveDraft}
          >
            <Save aria-hidden="true" size={16} /> Save draft
          </button>
        </div>

        <div className="action-rail__export-group">
          <button
            className="button button--ghost"
            type="button"
            title="Download formatted Markdown (.md)"
            onClick={handleDownloadMarkdown}
          >
            <Download aria-hidden="true" size={15} /> .md
          </button>
          <button
            className="button button--ghost"
            type="button"
            title="Copy Markdown to clipboard"
            onClick={handleCopyMarkdown}
          >
            {copiedMd ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
            {copiedMd ? "Copied" : "Copy MD"}
          </button>
          <button
            className="button button--ghost"
            type="button"
            title="Print or export as PDF"
            onClick={handlePrint}
          >
            <Printer aria-hidden="true" size={15} /> PDF
          </button>
        </div>

        <span className="action-rail__status">
          {saved
            ? "✓ Draft saved in this browser."
            : "Edits are stored locally while you work."}
        </span>
      </footer>
    </main>
  );
}
