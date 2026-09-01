/**
 * MaxXP window chrome: Luna titlebar, menu bar, optional browser toolbar, and
 * the status bar. Owns per-window motion (open/close/minimize/maximize) via
 * WAAPI so a window finishes animating before the shell unmounts it, plus the
 * eight resize edges and keyboard snap shortcuts.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { portfolio } from "../data/portfolio";
import { cn } from "../lib/cn";
import { MenuBar, type WindowMenu } from "../components/MenuBar";
import { Tooltip } from "../components/Tooltip";
import { playSfx } from "./audio";
import { appCatalog, xp, type AppId, type WindowRecord } from "./types";
import { openResumePdf } from "./content";

/** Compass points of the resize frame; the shell maps these onto geometry. */
export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const RESIZE_EDGES: ResizeEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Center-to-center delta from a window to its taskbar button, for genie motion. */
function taskbarDelta(element: HTMLElement | null, id: AppId) {
  const button = document.querySelector<HTMLElement>(`[data-taskbar-app="${id}"]`);
  const from = element?.getBoundingClientRect();
  const to = button?.getBoundingClientRect();
  if (!from || !to) return { x: 0, y: 46 };
  return {
    x: to.left + to.width / 2 - (from.left + from.width / 2),
    y: to.top + to.height / 2 - (from.top + from.height / 2),
  };
}

export function WindowChrome({
  record,
  active,
  children,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onDragStart,
  onResizeStart,
  onSnapRequest,
  openApp,
  onNavigate,
  canGoBack,
  canGoForward,
  crtEnabled,
  onToggleCrt,
}: {
  record: WindowRecord;
  active: boolean;
  children: ReactNode;
  onFocus: (id: AppId) => void;
  onClose: (id: AppId) => void;
  onMinimize: (id: AppId) => void;
  onMaximize: (id: AppId) => void;
  onDragStart: (event: ReactPointerEvent, record: WindowRecord) => void;
  onResizeStart: (event: ReactPointerEvent, record: WindowRecord, edge: ResizeEdge) => void;
  onSnapRequest: (id: AppId, half: "left" | "right" | "maximize") => void;
  openApp: (id: AppId) => void;
  onNavigate: (delta: -1 | 1) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  crtEnabled: boolean;
  onToggleCrt: () => void;
}) {
  const app = appCatalog[record.id];
  const isNotepad = record.id === "signature";
  // Minesweeper renders its own Game menu; Display Properties is a dialog.
  // Neither gets browser chrome, like the real things.
  const isGame = record.id === "minesweeper" || record.id === "display";
  const sectionRef = useRef<HTMLElement | null>(null);
  const exitAnimationRef = useRef<Animation | null>(null);
  const layoutAnimationRef = useRef<Animation | null>(null);
  const maximizeFromRectRef = useRef<DOMRect | null>(null);
  const previousMinimizedRef = useRef(record.minimized);

  const style = record.maximized
    ? { zIndex: record.z }
    : { left: record.x, top: record.y, width: record.width, height: record.height, zIndex: record.z };

  /* ------------------------------------------------------------------ */
  /* Exit motion (close / minimize)                                      */
  /* ------------------------------------------------------------------ */

  const animateOut = (
    keyframes: Keyframe[],
    done: () => void,
    options: { duration?: number; easing?: string } = {},
  ) => {
    const element = sectionRef.current;
    if (exitAnimationRef.current) return; // already leaving
    if (!element || prefersReducedMotion() || typeof element.animate !== "function") {
      done();
      return;
    }
    layoutAnimationRef.current?.cancel();
    layoutAnimationRef.current = null;
    const animation = element.animate(keyframes, {
      duration: options.duration ?? 150,
      easing: options.easing ?? EASE_OUT,
      fill: "forwards",
    });
    exitAnimationRef.current = animation;
    void animation.finished.then(done).catch(() => {
      exitAnimationRef.current = null;
    });
  };

  const handleClose = () =>
    animateOut(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.96)" },
      ],
      () => onClose(record.id),
    );

  const handleMinimize = () => {
    const { x, y } = taskbarDelta(sectionRef.current, record.id);
    animateOut(
      [
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", transformOrigin: "center" },
        { opacity: 0, transform: `translate3d(${x}px, ${y}px, 0) scale(0.18)`, transformOrigin: "center" },
      ],
      () => onMinimize(record.id),
      { duration: 190, easing: EASE_IN_OUT },
    );
    playSfx("minimize");
  };

  const handleMaximize = (event?: ReactMouseEvent<HTMLElement>) => {
    if (event && (event.target as Element).closest(".window-buttons")) return;
    maximizeFromRectRef.current = sectionRef.current?.getBoundingClientRect() ?? null;
    onMaximize(record.id);
  };

  /* ------------------------------------------------------------------ */
  /* Layout motion (maximize / restore-from-taskbar)                     */
  /* ------------------------------------------------------------------ */

  // FLIP the maximize/restore transition from the pre-layout rect.
  useLayoutEffect(() => {
    const element = sectionRef.current;
    const from = maximizeFromRectRef.current;
    maximizeFromRectRef.current = null;
    if (!element || !from || prefersReducedMotion()) return;

    const to = element.getBoundingClientRect();
    if (to.width <= 0 || to.height <= 0) return;
    layoutAnimationRef.current?.cancel();
    const animation = element.animate(
      [
        {
          transform: `translate3d(${from.left - to.left}px, ${from.top - to.top}px, 0) scale(${from.width / to.width}, ${from.height / to.height})`,
          transformOrigin: "top left",
        },
        { transform: "translate3d(0, 0, 0) scale(1)", transformOrigin: "top left" },
      ],
      { duration: 220, easing: EASE_OUT, fill: "both" },
    );
    layoutAnimationRef.current = animation;
    void animation.finished.then(() => animation.cancel()).catch(() => {});
  }, [record.maximized]);

  // Genie back out of the taskbar when un-minimized.
  useLayoutEffect(() => {
    const wasMinimized = previousMinimizedRef.current;
    previousMinimizedRef.current = record.minimized;
    if (!wasMinimized || record.minimized) return;

    const element = sectionRef.current;
    exitAnimationRef.current?.cancel();
    exitAnimationRef.current = null;
    if (!element || prefersReducedMotion()) return;

    const { x, y } = taskbarDelta(element, record.id);
    layoutAnimationRef.current?.cancel();
    const animation = element.animate(
      [
        { opacity: 0, transform: `translate3d(${x}px, ${y}px, 0) scale(0.18)`, transformOrigin: "center" },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", transformOrigin: "center" },
      ],
      { duration: 210, easing: EASE_OUT, fill: "both" },
    );
    layoutAnimationRef.current = animation;
    void animation.finished.then(() => animation.cancel()).catch(() => {});
  }, [record.id, record.minimized]);

  useEffect(
    () => () => {
      layoutAnimationRef.current?.cancel();
    },
    [],
  );

  /* ------------------------------------------------------------------ */
  /* Keyboard snap (Alt+Arrow — Win+Arrow is claimed by the host OS)     */
  /* ------------------------------------------------------------------ */

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!event.altKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onSnapRequest(record.id, "left");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onSnapRequest(record.id, "right");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      onSnapRequest(record.id, "maximize");
    }
  };

  /* ------------------------------------------------------------------ */
  /* Menus                                                               */
  /* ------------------------------------------------------------------ */

  const copyEmail = () => {
    void navigator.clipboard?.writeText(portfolio.links.email.replace(/^mailto:/, "")).catch(() => {});
  };

  const viewMenu: WindowMenu = {
    label: "View",
    items: [
      { label: "CRT Effects", checked: crtEnabled, onSelect: onToggleCrt },
      { label: "Full Screen", onSelect: () => document.documentElement.requestFullscreen?.() },
      "separator",
      { label: "Snap Left", onSelect: () => onSnapRequest(record.id, "left") },
      { label: "Snap Right", onSelect: () => onSnapRequest(record.id, "right") },
      { label: record.maximized ? "Restore" : "Maximize", onSelect: () => handleMaximize() },
    ],
  };

  const menus: WindowMenu[] = isNotepad
    ? [
        {
          label: "File",
          items: [
            { label: "Open About Max", onSelect: () => openApp("about") },
            "separator",
            { label: "Close", onSelect: handleClose },
          ],
        },
        {
          label: "Edit",
          items: [
            {
              label: "Copy Name",
              onSelect: () => {
                void navigator.clipboard?.writeText(portfolio.name).catch(() => {});
              },
            },
            { label: "Copy Email Address", onSelect: copyEmail },
          ],
        },
        { label: "Format", items: [{ label: "Word Wrap", checked: true, disabled: true }] },
        {
          label: "View",
          items: [
            { label: "Status Bar", checked: true, disabled: true },
            { label: "CRT Effects", checked: crtEnabled, onSelect: onToggleCrt },
          ],
        },
        { label: "Help", items: [{ label: "About Max", onSelect: () => openApp("about") }] },
      ]
    : [
        {
          label: "File",
          items: [
            { label: "New Window", disabled: true },
            {
              label: "Open Resume PDF",
              onSelect: () => {
                openApp("resume");
                window.setTimeout(openResumePdf, 80);
              },
            },
            "separator",
            { label: "Close", onSelect: handleClose },
          ],
        },
        {
          label: "Edit",
          items: [
            { label: "Copy Email Address", onSelect: copyEmail },
            { label: "Select All", disabled: true },
          ],
        },
        viewMenu,
        {
          label: "Help",
          items: [
            { label: "About Max", onSelect: () => openApp("about") },
            "separator",
            { label: "GitHub", href: portfolio.links.github },
            { label: "LinkedIn", href: portfolio.links.linkedin },
          ],
        },
      ];

  return (
    <section
      ref={sectionRef}
      data-window-id={record.id}
      className={cn(
        "xp-window",
        isNotepad && "is-notepad",
        isGame && "is-game",
        active && "is-active",
        record.maximized && "is-maximized",
        record.minimized && "is-minimized",
      )}
      style={style}
      aria-label={app.title}
      aria-hidden={record.minimized}
      inert={record.minimized}
      tabIndex={-1}
      onPointerDown={() => onFocus(record.id)}
      onKeyDown={handleKeyDown}
    >
      <header
        className="window-titlebar"
        onPointerDown={(event) => onDragStart(event, record)}
        onDoubleClick={(event) => handleMaximize(event)}
      >
        <div className="titlebar-title">
          <img src={app.icon} alt="" draggable={false} />
          <strong>{app.title}</strong>
        </div>
        <div className="window-buttons" onPointerDown={(event) => event.stopPropagation()}>
          <Tooltip label="Minimize">
            <button type="button" aria-label={`Minimize ${app.title}`} onClick={handleMinimize}>
              _
            </button>
          </Tooltip>
          <Tooltip label={record.maximized ? "Restore Down" : "Maximize"}>
            <button
              type="button"
              aria-label={`${record.maximized ? "Restore" : "Maximize"} ${app.title}`}
              onClick={() => handleMaximize()}
            >
              □
            </button>
          </Tooltip>
          <Tooltip label="Close">
            <button type="button" aria-label={`Close ${app.title}`} onClick={handleClose}>
              ×
            </button>
          </Tooltip>
        </div>
      </header>

      {!isGame ? <MenuBar menus={menus} ariaLabel={`${app.title} menu`} /> : null}

      {!isNotepad && !isGame ? (
        <>
          <div className="window-toolbar">
            <button
              type="button"
              className="toolbar-nav"
              disabled={!canGoBack}
              onClick={() => onNavigate(-1)}
              title="Back"
            >
              <img src={`${xp}/gui/toolbar/back.webp`} alt="" />
              <span>Back</span>
            </button>
            <button
              type="button"
              className="toolbar-nav toolbar-icon-only"
              disabled={!canGoForward}
              onClick={() => onNavigate(1)}
              title="Forward"
              aria-label="Forward"
            >
              <img src={`${xp}/gui/toolbar/forward.webp`} alt="" />
            </button>
            <span className="toolbar-divider" aria-hidden="true" />
            <button
              type="button"
              className="toolbar-icon-only"
              onClick={() => openApp("signature")}
              title="Home"
              aria-label="Home"
            >
              <img src={`${xp}/gui/toolbar/home.webp`} alt="" />
            </button>
            <button
              type="button"
              className="toolbar-icon-only"
              onClick={() => openApp("projects")}
              title="Projects"
              aria-label="Projects"
            >
              <img src={`${xp}/gui/toolbar/folder.webp`} alt="" />
            </button>
            <button
              type="button"
              className="toolbar-icon-only"
              onClick={onToggleCrt}
              title={crtEnabled ? "Turn off CRT effects" : "Turn on CRT effects"}
              aria-label="Toggle CRT effects"
              aria-pressed={crtEnabled}
            >
              <img src={`${xp}/gui/toolbar/lightdark.webp`} alt="" />
            </button>
          </div>
          <div className="address-bar">
            <span>Address</span>
            <div>
              <img src={app.icon} alt="" />
              maxxp://{record.id}
            </div>
            <button
              type="button"
              className="address-go"
              onClick={() => openApp(record.id)}
              title={`Go to maxxp://${record.id}`}
            >
              <img src={`${xp}/gui/toolbar/go.webp`} alt="" />
              <span>Go</span>
            </button>
          </div>
        </>
      ) : null}

      <div className="window-content">{children}</div>
      <footer className="window-status">{app.status}</footer>

      {!record.maximized
        ? RESIZE_EDGES.map((edge) => (
            <div
              key={edge}
              className={`resize-edge resize-${edge}`}
              data-resize-edge={edge}
              aria-hidden="true"
              onPointerDown={(event) => onResizeStart(event, record, edge)}
            />
          ))
        : null}
    </section>
  );
}
