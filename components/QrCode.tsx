"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** QR for the join link, rendered locally (the link never goes to a third-party QR service). */
export function QrCode({ value, label }: { value: string; label: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", margin: 1, color: { dark: "#1a1410", light: "#fff8ec" } }).then((s) => alive && setSvg(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [value]);
  // The SVG comes from the qrcode library (our own link), not from user HTML.
  return <div className="qr" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}
