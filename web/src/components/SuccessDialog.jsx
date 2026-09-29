import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  Printer,
  QrCode,
  Sparkles,
  X
} from "lucide-react";
import { formatRecipeMarkdown, printRecipeCard } from "../lib/export.js";

export function SuccessDialog({ result, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'crouton' | 'markdown' | 'pdf'

  const recipe = result.recipe;
  const fileName =
    recipe?.name?.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "recipe";

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(result.url, {
      width: 240,
      margin: 2,
      color: { dark: "#26142eff", light: "#ffffffff" },
      errorCorrectionLevel: "M"
    }).then((dataUrl) => {
      if (active) setQrDataUrl(dataUrl);
    });
    return () => {
      active = false;
    };
  }, [result.url]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(result.url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyMarkdown = async () => {
    const md = formatRecipeMarkdown(recipe, result.url);
    await navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handlePrint = () => {
    printRecipeCard(recipe);
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="success-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="dialog-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>

        <div className="success-header">
          <div className="success-badge">
            <Check aria-hidden="true" />
          </div>
          <div>
            <h2 id="success-title">Recipe is ready to export</h2>
            <p>Choose your preferred format or share the public link.</p>
          </div>
        </div>

        <div className="success-body">
          {/* Quick Share Strip */}
          <div className="share-url-box">
            <span className="share-url-text">{result.url.replace(/^https?:\/\//, "")}</span>
            <div className="share-url-actions">
              <button
                className="pill-btn pill-btn--subtle"
                type="button"
                onClick={copyLink}
              >
                {copiedLink ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copiedLink ? "Copied" : "Copy link"}
              </button>
              <a
                className="pill-btn pill-btn--subtle"
                href={result.url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink aria-hidden="true" /> Visit
              </a>
            </div>
          </div>

          {/* Export Formats Grid */}
          <div className="export-cards-grid">
            {/* Crouton Card */}
            <div className="export-card export-card--crouton">
              <div className="export-card__header">
                <div className="export-card__title">
                  <img src="/crouton_icon.png" alt="" className="export-card__icon-img" />
                  <div>
                    <strong>Crouton</strong>
                    <span>Scan QR or import file</span>
                  </div>
                </div>
              </div>
              <div className="export-card__content">
                <div className="qr-box">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt={`QR code for ${result.url}`} />
                  ) : (
                    <div className="qr-placeholder" />
                  )}
                  <small>Scan in Crouton app</small>
                </div>
                <div className="card-actions">
                  <a
                    className="export-action-btn"
                    href={result.crumbUrl}
                    download={`${fileName}.crumb`}
                  >
                    <Download aria-hidden="true" /> Download .crumb
                  </a>
                </div>
              </div>
            </div>

            {/* Markdown Card */}
            <div className="export-card">
              <div className="export-card__header">
                <div className="export-card__title">
                  <div className="export-card__icon export-card__icon--md">
                    <FileText aria-hidden="true" />
                  </div>
                  <div>
                    <strong>Markdown</strong>
                    <span>For Obsidian, Notion, Notes</span>
                  </div>
                </div>
              </div>
              <div className="export-card__content export-card__content--stacked">
                <p className="card-desc">
                  Clean checklist format with ingredients, instructions, and metadata.
                </p>
                <div className="card-actions card-actions--col">
                  <a
                    className="export-action-btn"
                    href={result.markdownUrl || `/api/recipes/${recipe.slug}/md`}
                    download={`${fileName}.md`}
                  >
                    <Download aria-hidden="true" /> Download .md
                  </a>
                  <button
                    className="export-action-btn export-action-btn--secondary"
                    type="button"
                    onClick={copyMarkdown}
                  >
                    {copiedMd ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    {copiedMd ? "Copied Markdown" : "Copy Markdown"}
                  </button>
                </div>
              </div>
            </div>

            {/* PDF / Print Card */}
            <div className="export-card">
              <div className="export-card__header">
                <div className="export-card__title">
                  <div className="export-card__icon export-card__icon--pdf">
                    <Printer aria-hidden="true" />
                  </div>
                  <div>
                    <strong>PDF / Print</strong>
                    <span>Kitchen-friendly recipe card</span>
                  </div>
                </div>
              </div>
              <div className="export-card__content export-card__content--stacked">
                <p className="card-desc">
                  Print or save as a beautifully formatted PDF recipe card without browser clutter.
                </p>
                <div className="card-actions card-actions--col">
                  <button
                    className="export-action-btn"
                    type="button"
                    onClick={handlePrint}
                  >
                    <Printer aria-hidden="true" /> Print / Save PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="dialog-footnote">
          Published links remain active for 1 hour. Exported files (.crumb, .md, PDF) never expire.
        </p>
      </section>
    </div>
  );
}
