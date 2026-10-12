"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
export function Share({ tab, item }: { tab: string; item: string }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [url, setUrl] = useState(""),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    const link = new URL(location.pathname, location.origin);
    link.searchParams.set("view", "workshop");
    link.searchParams.set("tab", tab);
    link.searchParams.set("item", item);
    setUrl(link.href);
    if (canvas.current)
      QRCode.toCanvas(canvas.current, link.href, {
        width: 150,
        margin: 2,
        color: { dark: "#271236", light: "#ffffff" },
      }).catch(() => {});
  }, [tab, item]);
  return (
    <details className="wk-share">
      <summary>링크·QR 공유</summary>
      <canvas ref={canvas} aria-label="이 활동으로 이동하는 QR 코드" />
      <a href={url}>{url}</a>
      <button
        className="secondary-button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "복사했어요" : "링크 복사"}
      </button>
    </details>
  );
}
