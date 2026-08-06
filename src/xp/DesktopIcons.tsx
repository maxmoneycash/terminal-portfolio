/**
 * Desktop icon grid plus the desktop right-click context menu.
 *
 * XP selection semantics: single click selects, double click (or Enter on a
 * selected icon) opens, Escape or a click on empty desktop clears.
 */
import { useCallback, useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { cn } from "../lib/cn";
import { appCatalog, desktopApps, type AppId } from "./types";
import { playSfx } from "./audio";

type ContextMenu = { x: number; y: number };

export function DesktopIcons({
  openApp,
  crtEnabled,
  onToggleCrt,
  onShowDesktop,
}: {
  openApp: (id: AppId) => void;
  crtEnabled: boolean;
  onToggleCrt: () => void;
  onShowDesktop: () => void;
}) {
  const [selected, setSelected] = useState<AppId | null>(null);
  const [menu, setMenu] = useState<ContextMenu | null>(null);

  const open = useCallback(
    (id: AppId) => {
      setSelected(null);
      playSfx("ding");
      openApp(id);
    },
    [openApp],
  );

  // Clear selection / dismiss the context menu from anywhere on the desktop.
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!target.closest(".desktop-icon")) setSelected(null);
      if (!target.closest(".desktop-context-menu")) setMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelected(null);
      setMenu(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest(".xp-window, .taskbar, .start-menu")) return;
    event.preventDefault();
    // Keep the menu on screen; XP flips it against the viewport edges.
    const x = Math.min(event.clientX, window.innerWidth - 190);
    const y = Math.min(event.clientY, window.innerHeight - 170);
    setMenu({ x, y });
  };

  return (
    <div className="desktop-surface" onContextMenu={handleContextMenu}>
      <section className="desktop-icons" id="desktop-icons" aria-label="Desktop applications">
        {desktopApps.map((id) => (
          <button
            key={id}
            className={cn("desktop-icon", selected === id && "is-selected")}
            type="button"
            aria-pressed={selected === id}
            onClick={() => setSelected(id)}
            onDoubleClick={() => open(id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                open(id);
              }
            }}
          >
            <img src={appCatalog[id].icon} alt="" draggable={false} />
            <span>{appCatalog[id].desktopLabel}</span>
          </button>
        ))}
      </section>

      {menu ? (
        <div
          className="desktop-context-menu"
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onShowDesktop();
              setMenu(null);
            }}
          >
            Show the Desktop
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onToggleCrt();
              setMenu(null);
            }}
          >
            {crtEnabled ? "✓ " : ""}CRT Effects
          </button>
          <div className="menu-separator" role="separator" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              open("about");
              setMenu(null);
            }}
          >
            About Max
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              open("stats");
              setMenu(null);
            }}
          >
            Properties
          </button>
        </div>
      ) : null}
    </div>
  );
}
