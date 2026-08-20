/**
 * The XP taskbar: start button, running-program buttons, and the system tray
 * (quick actions, volume, clock). Owns the ticking clock and the tray balloon,
 * which is anchored to the tray it points at.
 */
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { Tooltip } from "../components/Tooltip";
import { TrayBalloon } from "../components/TrayBalloon";
import { appCatalog, xp, type AppId, type WindowRecord } from "./types";
import { playSfx, getSystemVolume, setSystemVolume, subscribeVolume } from "./audio";

/** XP shows the clock to the minute; a 10s tick keeps it honest without churn. */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

function VolumeControl() {
  const [percent, setPercent] = useState(getSystemVolume);
  useEffect(() => {
    const unsubscribe = subscribeVolume(setPercent);
    return () => {
      unsubscribe();
    };
  }, []);

  const muted = percent === 0;
  return (
    <Tooltip label={muted ? "Volume: muted" : `Volume: ${percent}%`}>
      <button
        type="button"
        className="tray-volume"
        aria-label={muted ? "Unmute system sounds" : "Mute system sounds"}
        onClick={() => {
          setSystemVolume(muted ? 80 : 0);
          if (muted) playSfx("ding");
        }}
      >
        <img src={`${xp}/gui/tray/${muted ? "mute" : "volume"}.webp`} alt="" />
      </button>
    </Tooltip>
  );
}

export function Taskbar({
  windows,
  activeWindow,
  onTaskbarClick,
  startOpen,
  onToggleStart,
  crtEnabled,
  onToggleCrt,
  openApp,
  balloonVisible,
  onBalloonClose,
}: {
  windows: WindowRecord[];
  activeWindow: AppId | null;
  onTaskbarClick: (id: AppId) => void;
  startOpen: boolean;
  onToggleStart: () => void;
  crtEnabled: boolean;
  onToggleCrt: () => void;
  openApp: (id: AppId) => void;
  balloonVisible: boolean;
  onBalloonClose: () => void;
}) {
  const now = useClock();

  return (
    <>
      <TrayBalloon title="Welcome to MaxXP" visible={balloonVisible} onClose={onBalloonClose}>
        Every window is wired to real portfolio content. Click <strong>start</strong> to begin.
      </TrayBalloon>

      <footer className="taskbar">
        <button
          className={cn("start-button", startOpen && "is-active")}
          type="button"
          aria-expanded={startOpen}
          aria-controls="maxxp-start-menu"
          onClick={() => {
            if (!startOpen) playSfx("start");
            onToggleStart();
          }}
        >
          <img
            className="start-button-flag"
            src={`${xp}/gui/system/windows-flag.webp`}
            alt=""
            draggable={false}
          />
          <span className="start-button-label">start</span>
        </button>

        <div className="taskbar-programs">
          {windows.map((record) => {
            const isActive = activeWindow === record.id && !record.minimized;
            return (
              <button
                key={record.id}
                data-taskbar-app={record.id}
                className={cn(isActive && "is-active")}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  playSfx(isActive ? "minimize" : "restore");
                  onTaskbarClick(record.id);
                }}
              >
                <img src={appCatalog[record.id].icon} alt="" />
                <span>{appCatalog[record.id].shortTitle}</span>
              </button>
            );
          })}
        </div>

        <div className="system-tray">
          <Tooltip label="Open welcome note">
            <button type="button" aria-label="Open welcome note" onClick={() => openApp("signature")}>
              <img src={`${xp}/gui/tray/info.webp`} alt="" />
            </button>
          </Tooltip>
          <Tooltip label={crtEnabled ? "Turn off CRT effects" : "Turn on CRT effects"}>
            <button
              type="button"
              aria-label="Toggle CRT effects"
              aria-pressed={crtEnabled}
              onClick={onToggleCrt}
            >
              <img src={`${xp}/gui/tray/${crtEnabled ? "crt-on" : "crt-off"}.webp`} alt="" />
            </button>
          </Tooltip>
          <VolumeControl />
          <Tooltip label="Enter full screen">
            <button
              type="button"
              aria-label="Toggle fullscreen mode"
              onClick={() => document.documentElement.requestFullscreen?.()}
            >
              <img src={`${xp}/gui/taskbar/fullscreen.webp`} alt="" />
            </button>
          </Tooltip>
          <Tooltip
            label={now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          >
            <time dateTime={now.toISOString()}>
              {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </time>
          </Tooltip>
        </div>
      </footer>
    </>
  );
}
