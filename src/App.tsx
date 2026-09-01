/**
 * MaxXP — a Windows XP desktop simulator shell.
 *
 * Orchestrates the boot flow, window manager, desktop icons, taskbar, start
 * menu, tray, and CRT overlay. Subsystems live in src/xp/*.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "./lib/cn";
import { appCatalog, type AppId, type WindowRecord } from "./xp/types";
import { playSfx, bindAudioUnlockGestures } from "./xp/audio";
import { getCrtEnabled, subscribeCrt, toggleCrtEnabled } from "./xp/crtStore";
import { ScreenSaverOverlay } from "./components/ScreenSaver";
import { BootScreens, useBootFlow } from "./xp/BootScreens";
import { CrtOverlay } from "./xp/CrtOverlay";
import { DesktopIcons } from "./xp/DesktopIcons";
import { Taskbar } from "./xp/Taskbar";
import { StartMenu } from "./xp/StartMenu";
import { WindowChrome, type ResizeEdge } from "./xp/WindowChrome";
import { WindowContent } from "./xp/content";
import { Wallpaper } from "./xp/Wallpaper";
import { attachLiveDrag } from "./xp/liveGeometry";

const TASKBAR_HEIGHT = 30;

function createSignatureWindow(z = 2): WindowRecord {
  const { width, height } = appCatalog.signature.dimensions;
  const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  return {
    id: "signature",
    x: Math.max(16, Math.round((viewportWidth - width) / 2)),
    y: Math.max(24, Math.round((viewportHeight - height - TASKBAR_HEIGHT) / 2)),
    width,
    height,
    z,
    minimized: false,
    maximized: false,
  };
}

function App() {
  const [windows, setWindows] = useState<WindowRecord[]>(() => [createSignatureWindow()]);
  const [activeWindow, setActiveWindow] = useState<AppId | null>("signature");
  const [startOpen, setStartOpen] = useState(false);
  // Mirrors the CRT store so Display Properties and the shell stay in sync.
  const [crtEnabled, setCrtEnabledState] = useState(getCrtEnabled);
  const [balloonVisible, setBalloonVisible] = useState(false);
  const liveDragCleanupRef = useRef<(() => void) | null>(null);
  // Focus history powers the toolbar's Back/Forward, like a browser's session
  // history but over the apps visited in this session.
  const [history, setHistory] = useState<AppId[]>(["signature"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const suppressHistoryRef = useRef(false);
  const zRef = useRef(3);

  useEffect(() => {
    bindAudioUnlockGestures();
  }, []);

  useEffect(() => subscribeCrt(setCrtEnabledState), []);

  /* ------------------------------------------------------------------ */
  /* Boot flow                                                           */
  /* ------------------------------------------------------------------ */

  const resetSessionWindows = useCallback(() => {
    setWindows([createSignatureWindow(++zRef.current)]);
    setActiveWindow("signature");
    setStartOpen(false);
  }, []);

  const handleLoginComplete = useCallback(() => {
    resetSessionWindows();
    // Welcome balloon, once per session.
    let seen = false;
    try {
      seen = window.sessionStorage.getItem("maxxp:balloon") === "1";
    } catch {
      // Storage optional.
    }
    if (seen) return;
    window.setTimeout(() => {
      setBalloonVisible(true);
      playSfx("balloon");
      try {
        window.sessionStorage.setItem("maxxp:balloon", "1");
      } catch {
        // Storage optional.
      }
      window.setTimeout(() => setBalloonVisible(false), 9000);
    }, 1400);
  }, [resetSessionWindows]);

  const flow = useBootFlow({
    onLoginComplete: handleLoginComplete,
    onLogOff: resetSessionWindows,
  });

  /* ------------------------------------------------------------------ */
  /* Window manager                                                      */
  /* ------------------------------------------------------------------ */

  const pushHistory = useCallback((id: AppId) => {
    if (suppressHistoryRef.current) {
      suppressHistoryRef.current = false;
      return;
    }
    setHistory((current) => {
      const trimmed = current.slice(0, historyIndex + 1);
      if (trimmed[trimmed.length - 1] === id) return current;
      const next = [...trimmed, id].slice(-24);
      setHistoryIndex(next.length - 1);
      return next;
    });
  }, [historyIndex]);

  const focusWindow = useCallback((id: AppId) => {
    pushHistory(id);
    setActiveWindow(id);
    setWindows((current) =>
      current.map((record) =>
        record.id === id ? { ...record, z: ++zRef.current, minimized: false } : record,
      ),
    );
  }, [pushHistory]);

  const openApp = useCallback((id: AppId) => {
    setStartOpen(false);
    setWindows((current) => {
      const existing = current.find((record) => record.id === id);
      if (existing) {
        return current.map((record) =>
          record.id === id ? { ...record, z: ++zRef.current, minimized: false } : record,
        );
      }
      const app = appCatalog[id];
      const offset = current.length * 26;
      const x = Math.max(8, Math.min(150 + offset, window.innerWidth - app.dimensions.width - 8));
      const y = Math.max(8, Math.min(72 + offset, window.innerHeight - app.dimensions.height - TASKBAR_HEIGHT - 8));
      return [
        ...current,
        {
          id,
          x,
          y,
          width: app.dimensions.width,
          height: app.dimensions.height,
          z: ++zRef.current,
          minimized: false,
          maximized: false,
        },
      ];
    });
    setActiveWindow(id);
    pushHistory(id);
  }, [pushHistory]);

  const closeWindow = useCallback((id: AppId) => {
    setWindows((current) => current.filter((record) => record.id !== id));
    setStartOpen(false);
  }, []);

  // Dialog-style apps (Display Properties' OK button) close themselves.
  useEffect(() => {
    const handleClose = (event: Event) => {
      const id = (event as CustomEvent<{ id: AppId }>).detail?.id;
      if (id) closeWindow(id);
    };
    window.addEventListener("maxxp:close-window", handleClose);
    return () => window.removeEventListener("maxxp:close-window", handleClose);
  }, [closeWindow]);

  const minimizeWindow = useCallback((id: AppId) => {
    setWindows((current) =>
      current.map((record) => (record.id === id ? { ...record, minimized: true } : record)),
    );
  }, []);

  const maximizeWindow = useCallback((id: AppId) => {
    setWindows((current) =>
      current.map((record) =>
        record.id === id ? { ...record, maximized: !record.maximized, z: ++zRef.current } : record,
      ),
    );
    setActiveWindow(id);
  }, []);

  /** Step through the visited-app history without re-recording the jump. */
  const navigateHistory = useCallback(
    (delta: -1 | 1) => {
      const target = historyIndex + delta;
      const id = history[target];
      if (!id) return;
      setHistoryIndex(target);
      suppressHistoryRef.current = true;
      openApp(id);
    },
    [history, historyIndex, openApp],
  );

  const showDesktop = useCallback(() => {
    setWindows((current) => current.map((record) => ({ ...record, minimized: true })));
  }, []);

  const handleTaskbarClick = useCallback(
    (id: AppId) => {
      const record = windows.find((entry) => entry.id === id);
      if (!record) return;
      if (activeWindow === id && !record.minimized) {
        minimizeWindow(id);
      } else {
        focusWindow(id);
      }
    },
    [activeWindow, windows, focusWindow, minimizeWindow],
  );

  const handleSnapRequest = useCallback((id: AppId, half: "left" | "right" | "maximize") => {
    if (half === "maximize") {
      maximizeWindow(id);
      return;
    }
    const width = Math.floor(window.innerWidth / 2);
    const height = window.innerHeight - TASKBAR_HEIGHT;
    setWindows((current) =>
      current.map((record) =>
        record.id === id
          ? {
              ...record,
              x: half === "left" ? 0 : width,
              y: 0,
              width,
              height,
              maximized: false,
              z: ++zRef.current,
            }
          : record,
      ),
    );
    setActiveWindow(id);
  }, [maximizeWindow]);

  /* ------------------------------------------------------------------ */
  /* Drag + resize — painted on the element, committed once on pointerup */
  /* ------------------------------------------------------------------ */

  const commitGeometry = useCallback((id: AppId, box: { x: number; y: number; width: number; height: number }) => {
    liveDragCleanupRef.current = null;
    setWindows((current) =>
      current.map((record) => (record.id === id ? { ...record, ...box } : record)),
    );
  }, []);

  const startDrag = useCallback(
    (event: ReactPointerEvent, record: WindowRecord) => {
      if (record.maximized) return;
      event.preventDefault();
      const element = document.querySelector<HTMLElement>(`[data-window-id="${record.id}"]`);
      if (!element) return;
      liveDragCleanupRef.current?.();
      focusWindow(record.id);
      liveDragCleanupRef.current = attachLiveDrag({
        element,
        session: {
          mode: "move",
          startX: event.clientX,
          startY: event.clientY,
          originX: record.x,
          originY: record.y,
          width: record.width,
          height: record.height,
          minWidth: record.width,
          minHeight: record.height,
          clamp: (box) => ({
            ...box,
            x: Math.max(100 - box.width, Math.min(window.innerWidth - 100, box.x)),
            y: Math.max(0, Math.min(window.innerHeight - 50, box.y)),
          }),
        },
        onCommit: (box) => commitGeometry(record.id, box),
      });
    },
    [commitGeometry, focusWindow],
  );

  const startResize = useCallback(
    (event: ReactPointerEvent, record: WindowRecord, edge: ResizeEdge) => {
      event.preventDefault();
      event.stopPropagation();
      const element = document.querySelector<HTMLElement>(`[data-window-id="${record.id}"]`);
      if (!element) return;
      const app = appCatalog[record.id];
      liveDragCleanupRef.current?.();
      focusWindow(record.id);
      liveDragCleanupRef.current = attachLiveDrag({
        element,
        session: {
          mode: "resize",
          edge,
          startX: event.clientX,
          startY: event.clientY,
          originX: record.x,
          originY: record.y,
          width: record.width,
          height: record.height,
          minWidth: app.dimensions.minWidth,
          minHeight: app.dimensions.minHeight,
          clamp: (box) => ({
            ...box,
            width: Math.min(box.width, window.innerWidth - box.x),
            height: Math.min(box.height, window.innerHeight - TASKBAR_HEIGHT - box.y),
          }),
        },
        onCommit: (box) => commitGeometry(record.id, box),
      });
    },
    [commitGeometry, focusWindow],
  );

  useEffect(
    () => () => {
      liveDragCleanupRef.current?.();
    },
    [],
  );

  // Keep active window valid as windows close/minimize.
  useEffect(() => {
    if (activeWindow && windows.some((record) => record.id === activeWindow && !record.minimized)) return;
    const next = [...windows].filter((record) => !record.minimized).sort((a, b) => b.z - a.z)[0];
    setActiveWindow(next?.id ?? null);
  }, [activeWindow, windows]);

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  const desktopVisible = flow.phase === "desktop";

  return (
    <>
      <main
        className={cn("xp-desktop", !desktopVisible && "is-hidden")}
        aria-hidden={!desktopVisible}
        inert={!desktopVisible}
      >
        <Wallpaper />

        <DesktopIcons
          openApp={openApp}
          crtEnabled={crtEnabled}
          onToggleCrt={toggleCrtEnabled}
          onShowDesktop={showDesktop}
        />

        <div className="xp-windows-container">
          {desktopVisible &&
            windows
              .slice()
              .sort((a, b) => a.z - b.z)
              .map((record) => (
                <WindowChrome
                  key={record.id}
                  record={record}
                  active={activeWindow === record.id}
                  crtEnabled={crtEnabled}
                  onToggleCrt={toggleCrtEnabled}
                  onFocus={focusWindow}
                  onClose={closeWindow}
                  onMinimize={minimizeWindow}
                  onMaximize={maximizeWindow}
                  onDragStart={startDrag}
                  onResizeStart={startResize}
                  onSnapRequest={handleSnapRequest}
                  openApp={openApp}
                  onNavigate={navigateHistory}
                  canGoBack={historyIndex > 0}
                  canGoForward={historyIndex < history.length - 1}
                >
                  <WindowContent record={record} openApp={openApp} />
                </WindowChrome>
              ))}
        </div>

        <StartMenu
          open={startOpen && desktopVisible}
          openApp={openApp}
          onClose={() => setStartOpen(false)}
          onLogOff={() => flow.requestLogoffDialog("logOff")}
          onShutDown={() => flow.requestLogoffDialog("shutDown")}
        />

        <Taskbar
          windows={windows}
          activeWindow={activeWindow}
          onTaskbarClick={handleTaskbarClick}
          startOpen={startOpen}
          onToggleStart={() => setStartOpen((value) => !value)}
          crtEnabled={crtEnabled}
          onToggleCrt={toggleCrtEnabled}
          openApp={openApp}
          balloonVisible={balloonVisible && desktopVisible}
          onBalloonClose={() => setBalloonVisible(false)}
        />
      </main>

      <BootScreens flow={flow} />
      <CrtOverlay enabled={crtEnabled} />
      <ScreenSaverOverlay desktopVisible={desktopVisible} />
    </>
  );
}

export default App;
