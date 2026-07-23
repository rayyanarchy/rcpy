import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  X
} from "lucide-react";

export function SuccessDialog({ result, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(result.url, {
      width: 260,
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
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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
        <div className="success-title">
          <span><Check aria-hidden="true" /></span>
          <div>
            <h2 id="success-title">Ready for Crouton.</h2>
            <p>Scan this QR inside Crouton within the next hour.</p>
          </div>
        </div>
        <div className="success-content">
          <div className="qr-region">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR code for ${result.url}`} />
            ) : (
              <div className="qr-placeholder" />
            )}
            <a href={result.url} target="_blank" rel="noreferrer">
              {result.url.replace(/^https?:\/\//, "")}
            </a>
          </div>
          <div className="success-actions">
            <button type="button" onClick={copyLink}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <a href={result.crumbUrl} download>
              <Download aria-hidden="true" /> Download .crumb
            </a>
            <a href={result.url} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" /> Open recipe page
            </a>
          </div>
        </div>
        <p className="compatibility-note">
          This link expires one hour after publishing. First test: scan this QR with Crouton and confirm the imported fields.
          The `.crumb` download is available if link import needs adjustment.
        </p>
      </section>
    </div>
  );
}
