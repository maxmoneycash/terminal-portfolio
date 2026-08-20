/**
 * The XP start menu: user header, pinned + recent columns, the All Programs
 * bar, and the Log Off / Shut Down footer. Stays mounted while closed so the
 * open/close transition can run from CSS.
 */
import { useEffect, useRef } from "react";
import { portfolio } from "../data/portfolio";
import { appCatalog, xp, type AppId } from "./types";
import { playSfx } from "./audio";

const PINNED: { id: AppId; caption: string }[] = [
  { id: "projects", caption: "Portfolio explorer" },
  { id: "demos", caption: "Video showcase" },
];

const RECENT: AppId[] = ["signature", "about", "resume", "stats", "contact"];

export function StartMenu({
  open,
  openApp,
  onClose,
  onLogOff,
  onShutDown,
}: {
  open: boolean;
  openApp: (id: AppId) => void;
  onClose: () => void;
  onLogOff: () => void;
  onShutDown: () => void;
}) {
  const menuRef = useRef<HTMLElement | null>(null);

  // Dismiss on outside click or Escape, returning focus to the start button.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (menuRef.current?.contains(target) || target.closest(".start-button")) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onClose();
      window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".start-button")?.focus());
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const launch = (id: AppId) => {
    playSfx("menu");
    openApp(id);
  };

  return (
    <aside
      ref={menuRef}
      id="maxxp-start-menu"
      className="start-menu"
      data-state={open ? "open" : "closed"}
      aria-label="Start menu"
      aria-hidden={!open}
      inert={!open}
    >
      <header className="start-menu-header">
        <span className="start-avatar">M</span>
        <strong>{portfolio.name}</strong>
      </header>
      <div className="start-menu-divider" aria-hidden="true" />

      <div className="start-menu-body">
        <div className="start-menu-left">
          {PINNED.map(({ id, caption }) => (
            <button key={id} type="button" className="start-pinned" onClick={() => launch(id)}>
              <img src={appCatalog[id].icon} alt="" />
              <span>
                <strong>{appCatalog[id].title}</strong>
                <small>{caption}</small>
              </span>
            </button>
          ))}

          <div className="start-sep" aria-hidden="true" />

          {RECENT.map((id) => (
            <button key={id} type="button" className="start-recent" onClick={() => launch(id)}>
              <img src={appCatalog[id].icon} alt="" />
              {appCatalog[id].desktopLabel}
            </button>
          ))}

          <div className="start-all-programs" aria-hidden="true">
            <strong>All Programs</strong>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <polygon points="3,1 15,9 3,17" fill="#38aa38" stroke="#228822" strokeWidth="0.5" />
              <polygon points="5,4 12,9 5,14" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
            </svg>
          </div>
        </div>

        <div className="start-menu-right">
          <button type="button" onClick={() => launch("files")}>
            <img src={`${xp}/gui/toolbar/folder.webp`} alt="" />
            My Documents
          </button>
          <a href={portfolio.links.github} target="_blank" rel="noreferrer">
            <img src={`${xp}/gui/start-menu/github.webp`} alt="" />
            GitHub
          </a>
          <a href={portfolio.links.linkedin} target="_blank" rel="noreferrer">
            <img src={`${xp}/gui/start-menu/linkedin.webp`} alt="" />
            LinkedIn
          </a>
          <div className="start-sep" aria-hidden="true" />
          <button type="button" onClick={() => launch("resume")}>
            <img src={`${xp}/gui/start-menu/recently-used.webp`} alt="" />
            Recently Used
            <svg className="start-submenu-arrow" width="5" height="7" viewBox="0 0 5 7" aria-hidden="true">
              <polygon points="0,0 5,3.5 0,7" fill="currentColor" />
            </svg>
          </button>
          <button type="button" onClick={() => launch("demos")}>
            <img src={`${xp}/gui/start-menu/mediaPlayer.webp`} alt="" />
            Media Player
          </button>
        </div>
      </div>

      <footer className="start-menu-footer">
        <button type="button" onClick={onLogOff}>
          <img src={`${xp}/gui/start-menu/logoff.webp`} alt="" />
          <span>
            <u>L</u>og Off
          </span>
        </button>
        <button type="button" onClick={onShutDown}>
          <img src={`${xp}/gui/start-menu/shutdown.webp`} alt="" />
          <span>
            <u>S</u>hut Down
          </span>
        </button>
      </footer>
    </aside>
  );
}
