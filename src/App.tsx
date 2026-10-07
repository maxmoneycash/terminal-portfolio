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
import type { LiveProject } from "./components/LiveProjectApp";
import { IntroVideo, type IntroEnd } from "./xp/IntroVideo";
import { CrtOverlay } from "./xp/CrtOverlay";
import { DesktopIcons } from "./xp/DesktopIcons";
import { Taskbar } from "./xp/Taskbar";
import { StartMenu } from "./xp/StartMenu";
import { WindowChrome, type ResizeEdge } from "./xp/WindowChrome";
import { prefetchWindowApps, WindowContent } from "./xp/content";
import { Wallpaper } from "./xp/Wallpaper";
import { navigate, navigateApp, useRoute } from "./lib/navigation";
import { siteForId, siteForUrl } from "./data/liveApps";

type DragState =
  | { mode: "move"; id: AppId; startX: number; startY: number; originX: number; originY: number }
  | {
      mode: "resize";
      id: AppId;
      edge: ResizeEdge;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
      width: number;
      height: number;
    };

const TASKBAR_HEIGHT = 30;

function createProjectsWindow(z = 2): WindowRecord {
  const dimensions = appCatalog.projects.dimensions;
  const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const width = Math.min(dimensions.width, viewportWidth - 32);
  const height = Math.min(dimensions.height, viewportHeight - TASKBAR_HEIGHT - 48);
  return {
    id: "projects",
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
  const route = useRoute();
  const [windows, setWindows] = useState<WindowRecord[]>(() => [createProjectsWindow()]);
  const [activeWindow, setActiveWindow] = useState<AppId | null>("projects");
  const [browserProject, setBrowserProject] = useState<LiveProject | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const [introFading, setIntroFading] = useState<IntroEnd | null>(null);
  const introTriggerRef = useRef<HTMLElement | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  // Mirrors the CRT store so Display Properties and the shell stay in sync.
  const [crtEnabled, setCrtEnabledState] = useState(getCrtEnabled);
  const [balloonVisible, setBalloonVisible] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const zRef = useRef(3);

  useEffect(() => {
    bindAudioUnlockGestures();
  }, []);

  useEffect(() => subscribeCrt(setCrtEnabledState), []);

  useEffect(() => {
    if (!introFading) return;
    const timer = window.setTimeout(() => {
      setIntroOpen(false);
      setIntroFading(null);
      requestAnimationFrame(() => introTriggerRef.current?.focus({ preventScroll: true }));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [introFading]);

  /* ------------------------------------------------------------------ */
  /* Boot flow                                                           */
  /* ------------------------------------------------------------------ */

  const resetSessionWindows = useCallback(() => {
    setWindows([createProjectsWindow(++zRef.current)]);
    setActiveWindow("projects");
    setStartOpen(false);
  }, []);

  const handleLoginComplete = useCallback(() => {
    resetSessionWindows();
    setBalloonVisible(false);
  }, [resetSessionWindows]);

  const flow = useBootFlow({
    onLoginComplete: handleLoginComplete,
    onLogOff: resetSessionWindows,
  });

  // Fetch the on-demand apps once the intro has had a head start on its
  // video, or right away if the visitor skipped it or is already signed in.
  useEffect(() => {
    if (flow.phase !== "boot") {
      prefetchWindowApps();
      return;
    }
    const id = window.setTimeout(prefetchWindowApps, 4000);
    return () => window.clearTimeout(id);
  }, [flow.phase]);

  /* ------------------------------------------------------------------ */
  /* Window manager                                                      */
  /* ------------------------------------------------------------------ */

  const focusWindow = useCallback((id: AppId) => {
    navigateApp(id);
    setActiveWindow(id);
    setWindows((current) =>
      current.map((record) =>
        record.id === id ? { ...record, z: ++zRef.current, minimized: false } : record,
      ),
    );
  }, []);

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
      const width = Math.min(app.dimensions.width, window.innerWidth - 16);
      const height = Math.min(app.dimensions.height, window.innerHeight - TASKBAR_HEIGHT - 16);
      const offset = current.length * 26;
      const x = Math.max(8, Math.min(150 + offset, window.innerWidth - width - 8));
      const y = Math.max(8, Math.min(72 + offset, window.innerHeight - height - TASKBAR_HEIGHT - 8));
      return [
        ...current,
        {
          id,
          x,
          y,
          width,
          height,
          z: ++zRef.current,
          minimized: false,
          maximized: false,
        },
      ];
    });
    setActiveWindow(id);
    navigateApp(id);
  }, []);

  useEffect(() => {
    if (flow.phase !== "desktop") return;
    if (route.app === "browser") setBrowserProject(siteForId(route.site) ?? null);
    openApp(route.app);
  }, [route.app, route.site, flow.phase, openApp]);

  const openSite = useCallback((project: LiveProject) => {
    try {
      const url = new URL(project.url);
      if (!["https:", "http:"].includes(url.protocol)) return;
      const site = siteForUrl(url.href);
      if (!site) { window.open(url.href, "_blank", "noopener,noreferrer"); return; }
      setBrowserProject(site);
      navigate({ app: "browser", site: site.id });
      openApp("browser");
    } catch {
      // Malformed external URLs cannot navigate the shell.
    }
  }, [openApp]);

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
    navigateApp(id);
    setWindows((current) =>
      current.map((record) =>
        record.id === id ? { ...record, maximized: !record.maximized, z: ++zRef.current } : record,
      ),
    );
    setActiveWindow(id);
  }, []);

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
  /* Drag + resize                                                       */
  /* ------------------------------------------------------------------ */

  const startDrag = useCallback(
    (event: ReactPointerEvent, record: WindowRecord) => {
      if (record.maximized) return;
      event.preventDefault();
      setDrag({
        mode: "move",
        id: record.id,
        startX: event.clientX,
        startY: event.clientY,
        originX: record.x,
        originY: record.y,
      });
      focusWindow(record.id);
    },
    [focusWindow],
  );

  const startResize = useCallback(
    (event: ReactPointerEvent, record: WindowRecord, edge: ResizeEdge) => {
      event.preventDefault();
      event.stopPropagation();
      setDrag({
        mode: "resize",
        id: record.id,
        edge,
        startX: event.clientX,
        startY: event.clientY,
        originX: record.x,
        originY: record.y,
        width: record.width,
        height: record.height,
      });
      focusWindow(record.id);
    },
    [focusWindow],
  );

  useEffect(() => {
    if (!drag) return;

    const handleMove = (event: PointerEvent) => {
      setWindows((current) =>
        current.map((record) => {
          if (record.id !== drag.id) return record;
          const app = appCatalog[record.id];
          if (drag.mode === "move") {
            return {
              ...record,
              x: Math.max(100 - record.width, Math.min(window.innerWidth - 100, drag.originX + event.clientX - drag.startX)),
              y: Math.max(0, Math.min(window.innerHeight - 50, drag.originY + event.clientY - drag.startY)),
            };
          }
          const dx = event.clientX - drag.startX;
          const dy = event.clientY - drag.startY;
          let { originX: x, originY: y, width, height } = drag;
          if (drag.edge.includes("e")) width = drag.width + dx;
          if (drag.edge.includes("s")) height = drag.height + dy;
          if (drag.edge.includes("w")) {
            width = drag.width - dx;
            x = drag.originX + dx;
          }
          if (drag.edge.includes("n")) {
            height = drag.height - dy;
            y = drag.originY + dy;
          }
          if (width < app.dimensions.minWidth) {
            if (drag.edge.includes("w")) x -= app.dimensions.minWidth - width;
            width = app.dimensions.minWidth;
          }
          if (height < app.dimensions.minHeight) {
            if (drag.edge.includes("n")) y -= app.dimensions.minHeight - height;
            height = app.dimensions.minHeight;
          }
          width = Math.min(width, window.innerWidth - x);
          height = Math.min(height, window.innerHeight - TASKBAR_HEIGHT - y);
          return { ...record, x, y, width, height };
        }),
      );
    };

    const stopDrag = () => setDrag(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopDrag, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopDrag);
    };
  }, [drag]);

  // Keep active window valid as windows close/minimize.
  useEffect(() => {
    if (activeWindow && windows.some((record) => record.id === activeWindow && !record.minimized)) return;
    const next = [...windows].filter((record) => !record.minimized).sort((a, b) => b.z - a.z)[0];
    setActiveWindow(next?.id ?? null);
    if (next) navigateApp(next.id);
  }, [activeWindow, windows]);

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  const desktopVisible = flow.phase === "desktop";

  return (
    <>
      <main
        className={cn("xp-desktop", !desktopVisible && "is-hidden", windows.some(record => !record.minimized) && "has-open-window")}
        aria-hidden={!desktopVisible || introOpen}
        inert={!desktopVisible || introOpen}
      >
        <Wallpaper active={desktopVisible && !introOpen && !windows.some(record => !record.minimized)} />

        <DesktopIcons
          openApp={openApp}
          crtEnabled={crtEnabled}
          onToggleCrt={toggleCrtEnabled}
          onShowDesktop={showDesktop}
        />

        {/* CSS z-index handles stacking. Moving iframe DOM nodes would reload live apps. */}
        <div className="xp-windows-container">
          {desktopVisible &&
            windows
              .map((record) => (
                <WindowChrome
                  key={record.id}
                  record={record}
                  browserProject={record.id === "browser" ? browserProject : null}
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
                >
                  <WindowContent
                    record={record}
                    openApp={openApp}
                    onOpenSite={openSite}
                    browserProject={browserProject}
                    active={activeWindow === record.id && !record.minimized && !introOpen}
                    onWatchIntro={() => {
                      introTriggerRef.current = document.activeElement as HTMLElement;
                      setIntroOpen(true);
                    }}
                  />
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
      {introOpen ? <IntroVideo fading={introFading} onFinish={setIntroFading} /> : null}
      <CrtOverlay enabled={crtEnabled} />
      <ScreenSaverOverlay desktopVisible={desktopVisible && !introOpen && !activeWindow} />
    </>
  );
}

export default App;
