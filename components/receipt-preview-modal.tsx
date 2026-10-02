"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import type { ReceiptData } from "@/lib/types";

export function ReceiptPreviewModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptData | null;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!receipt?.sourceUrl || !receipt.mimeType?.startsWith("text/")) return;
    let active = true;
    setText("");
    setError("");
    fetch(receipt.sourceUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load this email receipt.");
        return response.text();
      })
      .then((value) => active && setText(value))
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load receipt.",
          );
      });
    return () => {
      active = false;
    };
  }, [receipt]);

  useEffect(() => {
    if (!receipt) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [receipt, onClose]);

  if (!receipt) return null;
  const isText = receipt.mimeType?.startsWith("text/");
  const isPdf = receipt.mimeType === "application/pdf";

  return (
    <div
      className="modal-backdrop receipt-preview-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal receipt-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Receipt source: ${receipt.filename}`}
      >
        <header>
          <div>
            <span className="label">
              {receipt.source.replaceAll("_", " ")} SOURCE
            </span>
            <h2>{receipt.merchant ?? receipt.filename}</h2>
            <p>{receipt.filename}</p>
          </div>
          <div className="receipt-preview-header-actions">
            <a
              className="button secondary"
              href={receipt.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} />
              Open original
            </a>
            <button
              className="icon-button"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="receipt-preview-content">
          {isText ? (
            error ? (
              <p className="form-error">{error}</p>
            ) : text ? (
              <pre className="email-receipt-source">{text}</pre>
            ) : (
              <div className="receipt-preview-loading">
                <FileText size={24} /> Loading email receipt…
              </div>
            )
          ) : isPdf ? (
            <iframe src={receipt.sourceUrl} title={receipt.filename} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receipt.sourceUrl} alt={`Receipt: ${receipt.filename}`} />
          )}
        </div>
      </section>
    </div>
  );
}
