import { useEffect, useState } from "react";

export function CopyLink({ href, label = "Copy link" }: { href: string; label?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  useEffect(() => setStatus("idle"), [href]);
  return <span className="copy-link">
    <button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(new URL(href, window.location.href).href); setStatus("copied"); }
      catch { setStatus("manual"); }
    }}>{status === "copied" ? "Copied" : label}</button>
    {status === "manual" ? <input aria-label="Link to copy" readOnly value={new URL(href, window.location.href).href} onFocus={event => event.currentTarget.select()} autoFocus /> : null}
    <span className="sr-only" role="status">{status === "copied" ? "Link copied" : ""}</span>
  </span>;
}
