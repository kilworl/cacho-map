"use client";
import RotatingText from "./reactbits/RotatingText";
import { useI18n } from "@/lib/i18n/LangProvider";

export function LoadingState() {
  const { t } = useI18n();
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading-horns" aria-hidden="true">
        <span>🦌</span>
      </div>
      <RotatingText
        texts={[...t.loading]}
        rotationInterval={1900}
        splitBy="words"
        staggerDuration={0.03}
        effect="slide"
        mainClassName="loading-line"
      />
      <div className="loading-bar" aria-hidden="true"><span /></div>
    </div>
  );
}
