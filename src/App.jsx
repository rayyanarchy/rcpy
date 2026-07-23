import { useEffect, useState } from "react";
import { AppHeader } from "./components/AppHeader.jsx";
import { ReviewView } from "./components/ReviewView.jsx";
import { SuccessDialog } from "./components/SuccessDialog.jsx";
import { UploadView } from "./components/UploadView.jsx";
import { processAudio, publishRecipe } from "./lib/api.js";

const localDraftKey = "crumbly:recipe-draft";

export default function App() {
  const [draft, setDraft] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [publishedSlug, setPublishedSlug] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedDraft = localStorage.getItem(localDraftKey);
    if (!savedDraft) return;
    try {
      setDraft(JSON.parse(savedDraft));
      setSaved(true);
    } catch {
      localStorage.removeItem(localDraftKey);
    }
  }, []);

  const handleProcess = async (file) => {
    setError("");
    setIsProcessing(true);
    try {
      const response = await processAudio(file);
      setDraft(response.draft);
      setSaved(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePublish = async () => {
    setError("");
    setIsPublishing(true);
    try {
      const response = await publishRecipe(draft, publishedSlug);
      setPublishedSlug(response.recipe.slug);
      setDraft({
        sourceLanguage: response.recipe.sourceLanguage,
        originalTranscript: response.recipe.originalTranscript,
        englishTranscript: response.recipe.englishTranscript,
        name: response.recipe.name,
        description: response.recipe.description,
        servings: response.recipe.servings,
        prepMinutes: response.recipe.prepMinutes,
        cookMinutes: response.recipe.cookMinutes,
        ingredients: response.recipe.ingredients,
        steps: response.recipe.steps,
        notes: response.recipe.notes
      });
      setResult(response);
      localStorage.removeItem(localDraftKey);
      setSaved(false);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const saveDraft = () => {
    localStorage.setItem(localDraftKey, JSON.stringify(draft));
    setSaved(true);
  };

  const startOver = () => {
    setDraft(null);
    setResult(null);
    setPublishedSlug("");
    setError("");
    setSaved(false);
    localStorage.removeItem(localDraftKey);
  };

  return (
    <div className="app-shell">
      <AppHeader reviewMode={Boolean(draft)} onStartOver={startOver} />
      {draft ? (
        <ReviewView
          draft={draft}
          onChange={(next) => {
            setDraft(next);
            setSaved(false);
          }}
          onPublish={handlePublish}
          onSaveDraft={saveDraft}
          isPublishing={isPublishing}
          error={error}
          saved={saved}
          isPublished={Boolean(publishedSlug)}
        />
      ) : (
        <UploadView
          onProcess={handleProcess}
          isProcessing={isProcessing}
          error={error}
          clearError={() => setError("")}
        />
      )}
      {result && (
        <SuccessDialog result={result} onClose={() => setResult(null)} />
      )}
    </div>
  );
}
