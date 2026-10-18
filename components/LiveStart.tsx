"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CityContext } from "@/lib/types";
import { useI18n } from "@/lib/i18n/LangProvider";
import ClickSpark from "./reactbits/ClickSpark";

/** "Pareja en vivo": opens a room for the selected city and language, then goes to person 1's page. */
export function LiveStart({ city }: { city: CityContext }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const create = async () => {
    setBusy(true);
    setErr(false);
    try {
      const res = await fetch("/api/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang, city }) });
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(data.error);
      router.push(`/live/${data.id}?p=a`);
    } catch {
      setErr(true);
      setBusy(false);
    }
  };
  return (
    <div className="live-start">
      <p className="intro">{t.liveIntro}</p>
      <ClickSpark sparkColor={["#ff3b1f", "#ffc21a", "#2563ff"]} sparkCount={10} sparkRadius={28} shape="star">
        <button type="button" className="cta" disabled={busy} onClick={() => void create()}>
          {busy ? t.liveCreating : t.liveCreate} <span aria-hidden="true">→</span>
        </button>
      </ClickSpark>
      {err && <p className="error" role="alert">{t.errors.busy}</p>}
    </div>
  );
}
