"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/LangProvider";

export function ShareActions({ url, text }: { url: string; text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="share">
      <a className="btn btn--wa" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noreferrer">
        {t.share}
      </a>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={async () => {
          await navigator.clipboard?.writeText(url).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        {copied ? t.copied : t.copy}
      </button>
    </div>
  );
}
