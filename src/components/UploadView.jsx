import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  CircleStop,
  CloudUpload,
  FileAudio,
  LoaderCircle,
  Mic,
  ScanLine,
  ScrollText,
  ShieldCheck,
  X
} from "lucide-react";
import { useRecorder } from "../hooks/useRecorder.js";
import { Waveform } from "./Waveform.jsx";

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
    <main className="upload-view">
      <section className="upload-hero" aria-labelledby="upload-title">
        <Waveform className="waveform--left" />
        <Waveform className="waveform--right" />
        <h1 id="upload-title">
          Turn a spoken recipe into something Crouton can read.
        </h1>
        <p>
          Upload a recording in any language. Review the English recipe, then
          scan its QR code in Crouton.
        </p>
      </section>

      <section
        className={`upload-frame ${dragActive ? "is-dragging" : ""} ${
          file ? "has-file" : ""
        }`}
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
          <>
            <CloudUpload className="upload-frame__icon" aria-hidden="true" />
            <h2>Drop an audio file here</h2>
            <div className="choose-row">
              <span>or</span>
              <button
                className="button button--outline"
                type="button"
                onClick={() => inputRef.current?.click()}
              >
                choose a file
              </button>
            </div>
            <p className="format-note">
              MP3, M4A, WAV, MP4, WebM · up to 50 MB
            </p>
          </>
        ) : (
          <div className="selected-file">
            <FileAudio aria-hidden="true" />
            <div>
              <strong>{file.name}</strong>
              <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Remove selected audio"
              onClick={() => setFile(null)}
            >
              <X aria-hidden="true" />
            </button>
            <audio controls src={previewUrl}>
              <track kind="captions" />
            </audio>
          </div>
        )}

        <div className="or-divider"><span>or</span></div>

        <button
          className={`record-action ${recorder.isRecording ? "is-recording" : ""}`}
          type="button"
          onClick={recorder.isRecording ? recorder.stop : recorder.start}
          disabled={isProcessing}
        >
          <span className="record-action__icon">
            {recorder.isRecording ? (
              <CircleStop aria-hidden="true" />
            ) : (
              <Mic aria-hidden="true" />
            )}
          </span>
          <span>
            {recorder.isRecording
              ? `Stop recording · ${formatTime(recorder.seconds)}`
              : "Record instead"}
          </span>
        </button>

        {!file && !recorder.isRecording && (
          <div className="ready-status">
            <AudioLines aria-hidden="true" />
            <span>Ready to upload</span>
          </div>
        )}

        {file && (
          <button
            className="button button--primary create-draft"
            type="button"
            onClick={() => onProcess(file)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <LoaderCircle className="spin" aria-hidden="true" />
                Listening and structuring…
              </>
            ) : (
              <>
                <AudioLines aria-hidden="true" />
                Create recipe draft
              </>
            )}
          </button>
        )}
      </section>

      {(localError || recorder.error || error) && (
        <div className="error-message" role="alert">
          {localError || recorder.error || error}
        </div>
      )}

      <section id="how-it-works" className="steps-strip" aria-label="How it works">
        <article>
          <span className="step-number">1</span>
          <AudioLines aria-hidden="true" />
          <div><h3>Transcribe</h3><p>We convert your audio into text.</p></div>
        </article>
        <article>
          <span className="step-number">2</span>
          <ScrollText aria-hidden="true" />
          <div><h3>Review</h3><p>You review the English recipe.</p></div>
        </article>
        <article>
          <span className="step-number">3</span>
          <ScanLine aria-hidden="true" />
          <div><h3>Scan</h3><p>Scan the QR code in Crouton.</p></div>
        </article>
      </section>

      <p className="privacy-note">
        <ShieldCheck aria-hidden="true" />
        Audio is deleted after processing. Published recipes use an
        unguessable link.
      </p>
    </main>
  );
}
