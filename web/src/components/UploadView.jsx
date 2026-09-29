import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleStop,
  CloudUpload,
  FileAudio,
  LoaderCircle,
  Mic,
  Plus,
  X
} from "lucide-react";
import { useRecorder } from "../hooks/useRecorder.js";

const maxBytes = 50 * 1024 * 1024;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function UploadView({ onProcess, isProcessing, error, clearError }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState("");
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file]
  );
  const recorder = useRecorder((recordedFile) => {
    setFile(recordedFile);
    setLocalError("");
    clearError();
  });

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const acceptFile = (candidate) => {
    setLocalError("");
    clearError();
    if (!candidate) return;
    if (candidate.size > maxBytes) {
      setLocalError("That recording is larger than 50 MB.");
      return;
    }
    setFile(candidate);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    acceptFile(event.dataTransfer.files?.[0]);
  };

  return (
    <main className="home-upload">
      <section className="home-hero" aria-labelledby="upload-title">
        <h1 id="upload-title">
          <span className="home-hero__first-line">Dictate recipes</span>
          <span className="home-hero__second-line">
            <span className="home-hero__into">into</span>
            <img
              className="crouton-mark"
              src="/crouton_icon.png"
              alt=""
            />
            <span className="home-hero__crouton-word" aria-hidden="true">
              Crouton,
            </span>
            <span className="home-hero__extra">Markdown &amp; PDF.</span>
          </span>
        </h1>
        <p>
          Upload a voice note or video. RCPY extracts structured ingredients and steps,
          <br className="hero-break" />
          ready for Crouton (.crumb), Markdown (.md), and PDF export.
        </p>
        <div className="home-hero__tags" aria-label="Supported output formats">
          <span className="hero-format-tag">.crumb</span>
          <span className="hero-format-tag">.md</span>
          <span className="hero-format-tag">PDF</span>
          <span className="hero-format-tag">JSON-LD</span>
        </div>
      </section>

      <section
        className={`home-dropzone ${dragActive ? "is-dragging" : ""} ${
          file ? "has-file" : ""
        }`}
        aria-label="Recipe recording upload"
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setDragActive(false);
          }
        }}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          className="file-input"
          type="file"
          accept=".flac,.mp3,.mp4,.mpeg,.mpga,.m4a,.ogg,.wav,.webm,audio/*"
          onChange={(event) => acceptFile(event.target.files?.[0])}
        />

        {!file ? (
          <div className="home-dropzone__content">
            <h2>
              <CloudUpload aria-hidden="true" />
              <span>Drop your recipe</span>
            </h2>
            <div className="home-actions">
              <button
                className="home-pill"
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isProcessing || recorder.isRecording}
              >
                <span className="home-pill__icon" aria-hidden="true">
                  <Plus />
                </span>
                Choose File
              </button>
              <span className="home-actions__or">or</span>
              <button
                className={`home-pill ${
                  recorder.isRecording ? "is-recording" : ""
                }`}
                type="button"
                onClick={
                  recorder.isRecording ? recorder.stop : recorder.start
                }
                disabled={isProcessing}
              >
                <span className="home-pill__icon" aria-hidden="true">
                  {recorder.isRecording ? <CircleStop /> : <Mic />}
                </span>
                {recorder.isRecording
                  ? `Stop · ${formatTime(recorder.seconds)}`
                  : "Record"}
              </button>
            </div>
            <p className="format-note">
              mp3, mp4, MVA, M4A, WebM Up to 50mb
            </p>
          </div>
        ) : (
          <div className="home-selected-file">
            <div className="home-selected-file__summary">
              <FileAudio aria-hidden="true" />
              <div>
                <strong>{file.name}</strong>
                <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Remove selected recording"
                onClick={() => setFile(null)}
                disabled={isProcessing}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <audio controls src={previewUrl}>
              <track kind="captions" />
            </audio>
            <button
              className="home-pill home-pill--process"
              type="button"
              onClick={() => onProcess(file)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <LoaderCircle className="spin" aria-hidden="true" />
                  Preparing…
                </>
              ) : (
                <>
                  <CloudUpload aria-hidden="true" />
                  Create Recipe
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {(localError || recorder.error || error) && (
        <div className="error-message" role="alert">
          {localError || recorder.error || error}
        </div>
      )}

      <p className="home-privacy-note">
        <svg
          className="home-privacy-note__icon"
          viewBox="0 0 20 22"
          aria-hidden="true"
        >
          <path d="M10 1.2 18 4v6.2c0 5.4-3.3 8.9-8 10.6-4.7-1.7-8-5.2-8-10.6V4l8-2.8Z" />
          <path
            className="home-privacy-note__check"
            d="m6.7 10.8 2 2 4.6-5"
          />
        </svg>
        Audio is deleted after processing. Published recipes use an unguessable
        link.
      </p>
    </main>
  );
}
