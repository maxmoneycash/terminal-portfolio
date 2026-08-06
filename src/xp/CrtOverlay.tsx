/**
 * CRT overlay — scanlines and a vignette drawn above the whole shell to sell
 * the period display. Rendered outside the desktop so it also covers the boot,
 * login, and shutdown screens. Persists its state across visits.
 */
import { useEffect } from "react";

const STORAGE_KEY = "maxxp:crt";

/** Read the saved CRT preference; defaults to on. */
export function readCrtPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true; // Storage is optional.
  }
}

export function CrtOverlay({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      // Storage is optional; the toggle still works for this visit.
    }
  }, [enabled]);

  // The shell keys off this class for its own CRT-dependent styling.
  useEffect(() => {
    document.documentElement.classList.toggle("crt-on", enabled);
    return () => document.documentElement.classList.remove("crt-on");
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="crt-overlay" aria-hidden="true">
      <div className="crt-scanline" />
      <div className="crt-vignette" />
    </div>
  );
}
