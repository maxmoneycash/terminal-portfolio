/**
 * The XP start menu: user header, pinned + recent columns, the All Programs
 * bar, and the Log Off / Shut Down footer. Stays mounted while closed so the
 * open/close transition can run from CSS.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { portfolio } from "../data/portfolio";
import { appCatalog, xp, type AppId } from "./types";
import { playSfx } from "./audio";

const PINNED: { id: AppId; caption: string }[] = [
  { id: "projects", caption: "Portfolio explorer" },
  { id: "demos", caption: "Video showcase" },
];

const RECENT: AppId[] = ["signature", "about", "resume", "stats", "minesweeper", "contact"];

/** Real tools from uses.txt; icons ship with the XP asset set. */
const DAILY_TOOLS: { name: string; icon: string; href: string }[] = [
  { name: "Cursor", icon: "cursor", href: "https://cursor.com" },
  { name: "Claude", icon: "claude", href: "https://claude.ai" },
  { name: "Git", icon: "git", href: "https://git-scm.com" },
  { name: "Docker", icon: "docker", href: "https://www.docker.com" },
  { name: "Blender", icon: "blender", href: "https://www.blender.org" },
  { name: "DaVinci Resolve", icon: "davinci", href: "https://www.blackmagicdesign.com/products/davinciresolve" },
  { name: "OBS Studio", icon: "obs", href: "https://obsproject.com" },
];

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
  const [programsOpen, setProgramsOpen] = useState(false);

  // The flyout never outlives the menu.
  useEffect(() => {
    if (!open) setProgramsOpen(false);
  }, [open]);

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

          <button
            type="button"
            className={cn("start-all-programs", programsOpen && "is-open")}
            aria-haspopup="menu"
            aria-expanded={programsOpen}
            onClick={() => {
              playSfx("menu");
              setProgramsOpen((value) => !value);
            }}
          >
            <strong>All Programs</strong>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <polygon points="3,1 15,9 3,17" fill="#38aa38" stroke="#228822" strokeWidth="0.5" />
              <polygon points="5,4 12,9 5,14" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
            </svg>
          </button>

          {programsOpen ? (
            <div className="start-programs-flyout" role="menu" aria-label="All Programs">
              <div className="start-programs-group" aria-hidden="true">
                Games
              </div>
              <button type="button" role="menuitem" onClick={() => launch("minesweeper")}>
                <img src={appCatalog.minesweeper.icon} alt="" />
                Minesweeper
              </button>
              <div className="start-sep" aria-hidden="true" />
              <div className="start-programs-group" aria-hidden="true">
                Tools I use daily
              </div>
              {DAILY_TOOLS.map((tool) => (
                <a
                  key={tool.name}
                  role="menuitem"
                  href={tool.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src={`${xp}/gui/start-menu/vanity-apps/${tool.icon}.webp`} alt="" />
                  {tool.name}
                </a>
              ))}
            </div>
          ) : null}
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
