import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { ApiError, publishRecipe } from "../lib/api";
import { download, fileSlug, printRecipe, toMarkdown } from "../lib/export";
import type { PublishResponse, RecipeDraft } from "../lib/types";

type Busy = "" | "crouton" | "link";

const isTouch = () => window.matchMedia("(pointer: coarse)").matches;

function expiryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ExportPanel({ draft }: { draft: RecipeDraft }) {
  const [published, setPublished] = useState<PublishResponse | null>(null);
  const snapshot = useRef("");
  const [busy, setBusy] = useState<Busy>("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");
  const [showCrouton, setShowCrouton] = useState(false);
  // Phones get a sticky Open in Crouton bar until the full panel scrolls into view.
  const panel = useRef<HTMLElement>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  useEffect(() => {
    if (!panel.current) return;
    const observer = new IntersectionObserver(([entry]) => setPanelVisible(entry.isIntersecting));
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, []);

  const current = JSON.stringify(draft);
  const upToDate = published !== null && snapshot.current === current;

  // Keep the Crouton QR pointing at the latest published version.
  useEffect(() => {
    if (!published) return;
    let live = true;
    QRCode.toDataURL(published.url, {
      margin: 1,
      width: 360,
      color: { dark: "#121212", light: "#ffffff" },
    })
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(""));
    return () => {
      live = false;
    };
  }, [published]);

  /** Save (or re-save after edits) so there is a link and a .crumb to hand out. */
  async function ensurePublished(): Promise<PublishResponse> {
    if (published && upToDate) return published;
    let result: PublishResponse;
    try {
      result = await publishRecipe(draft, published?.recipe.slug);
    } catch (caught) {
      // The old link may have expired; start a fresh one.
      if (!published) throw caught;
      result = await publishRecipe(draft);
    }
    snapshot.current = current;
    setPublished(result);
    return result;
  }

  async function run(kind: Busy, action: (result: PublishResponse) => void | Promise<void>) {
    setError("");
    setBusy(kind);
    try {
      await action(await ensurePublished());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy("");
    }
  }

  const openInCrouton = () =>
    run("crouton", (result) => {
      // On a phone the .crumb file opens straight in Crouton; on a computer, scan the QR with the phone.
      if (isTouch()) window.location.href = result.crumbUrl;
      else setShowCrouton(true);
    });

  const copyLink = () =>
    run("link", async (result) => {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    });

  return (
    <>
      <section ref={panel} className="panel export" id="export" aria-labelledby="export-title">
        <h2 id="export-title" className="eyebrow">
          Export
        </h2>
        <button
          type="button"
          className="button button--primary export__crouton"
          onClick={openInCrouton}
          disabled={!!busy}
        >
          <img src="/crouton_icon.png" alt="" width={22} height={22} />
          {busy === "crouton" ? "Saving…" : "Open in Crouton"}
        </button>

        {showCrouton && published && (
          <div className="export__qr">
            {qr && <img src={qr} alt={`QR code for ${published.url}`} width={140} height={140} />}
            <div>
              <p>Scan with your phone to import into Crouton.</p>
              <a className="export__link" href={published.crumbUrl} download={`${fileSlug(draft.name)}.crumb`}>
                Or download the .crumb file
              </a>
              {!upToDate && <p className="export__stale">You've edited since. Tap Open in Crouton again to update.</p>}
            </div>
          </div>
        )}

        <div className="export__row">
          <button
            type="button"
            className="button"
            onClick={() =>
              download(
                toMarkdown(draft, upToDate ? published?.url : undefined),
                `${fileSlug(draft.name)}.md`,
                "text/markdown",
              )
            }
          >
            Markdown
          </button>
          <button type="button" className="button" onClick={() => printRecipe(draft)}>
            PDF
          </button>
        </div>
        <button type="button" className="button" onClick={copyLink} disabled={!!busy}>
          {busy === "link" ? "Saving…" : copied ? "Link copied" : "Copy share link"}
        </button>
        <p className="export__note" aria-live="polite">
          {published
            ? `Your link works until ${expiryTime(published.recipe.expiresAt)}, then the recipe is deleted.`
            : "Share links work for one hour, then the recipe is deleted."}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
      <div className={`export__bar${panelVisible ? " is-hidden" : ""}`} aria-hidden={panelVisible}>
        <button type="button" className="button button--primary" onClick={openInCrouton} disabled={!!busy}>
          <img src="/crouton_icon.png" alt="" width={24} height={24} />
          {busy === "crouton" ? "Saving…" : "Open in Crouton"}
        </button>
        <a href="#export" className="button" aria-label="More export options">
          More
        </a>
      </div>
    </>
  );
}
