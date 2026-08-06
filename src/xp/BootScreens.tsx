/**
 * MaxXP boot subsystem: pre-boot overlay, boot screen, boot→login crossfade,
 * login screen (with welcome + shutdown states), and the log off / turn off
 * confirmation dialog.
 *
 * Visual metrics and timings follow the Windows XP (Luna) design language;
 * the state machine and code structure are original to this project.
 */
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { xp, type BootPhase } from "./types";
import {
  bindAudioUnlockGestures,
  playSfx,
  playStingAndWait,
  unlockAudio,
} from "./audio";
import { portfolio } from "../data/portfolio";
import { cn } from "../lib/cn";
import "./boot.css";

export type LogoffDialogType = "logOff" | "shutDown";

const APP_NAME = "MaxXP";

/** Images gated on before the boot screen may finish. */
const BOOT_PRELOAD_IMAGES = [
  `${xp}/gui/desktop/about.webp`,
  `${xp}/gui/desktop/projects.webp`,
  `${xp}/gui/desktop/contact.webp`,
  `${xp}/gui/desktop/resume.webp`,
  `${xp}/gui/taskbar/start-button.webp`,
  `${xp}/gui/taskbar/taskbar-bg.webp`,
  `${xp}/gui/taskbar/system-tray-bg.webp`,
];

// Boot timeline (ms), measured from boot-flow start.
const PREBOOT_MS = 1000; // black pre-boot overlay hold
const BOOT_MIN_MS = 3750; // minimum boot-screen dwell before fade-out
const BOOT_POLL_MS = 100; // asset-gate poll interval
const FADEOUT_OVERLAY_IN_MS = 250; // boot fade-out → black overlay fade-in
const FADEOUT_TO_LOGIN_MS = 1150; // black hold → login screen revealed
const FADEOUT_OVERLAY_OUT_MS = 500; // black overlay fade-away duration

// Login timeline (ms), measured from the user-tile click.
const LOGIN_FADE_MS = 160; // tile active → login chrome starts fading (0.3s)
const LOGIN_WELCOME_MS = 460; // chrome hidden → welcome shown (fades in 0.7s)
const LOGIN_DONE_MS = 2460; // welcome hides → desktop
const LOGIN_STING_MAX_MS = 6000;

// Restart/shutdown timeline (ms).
const SHUTDOWN_TEXT_SWAP_MS = 1350; // "Logging off..." → "MaxXP is shutting down..."
const SHUTDOWN_MIN_MS = 2600; // minimum hold after the text swap
const SHUTDOWN_STING_MAX_MS = 4000;

const GRAYSCALE_DELAY_MS = 700; // dialog open → rest of screen desaturates

/** Internal stage machine; the public BootPhase is derived from it. */
type Stage =
  | "preboot"
  | "boot"
  | "boot-out"
  | "login"
  | "login-fade"
  | "welcome"
  | "desktop"
  | "shutdown";

function phaseForStage(stage: Stage): BootPhase {
  switch (stage) {
    case "preboot":
    case "boot":
    case "boot-out":
      return "boot";
    case "login":
    case "shutdown":
      return "login";
    case "login-fade":
    case "welcome":
      return "welcome";
    case "desktop":
      return "desktop";
  }
}

type InitialBoot = { stage: Stage; restored: boolean };

function resolveInitialBoot(): InitialBoot {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("forceBoot") === "true") {
      // Strip the param so a later refresh boots normally.
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.hash,
      );
      window.sessionStorage.removeItem("logged_in");
    }
    if (window.sessionStorage.getItem("logged_in") === "true") {
      return { stage: "desktop", restored: true };
    }
  } catch {
    // storage/URL unavailable — fall through to a full boot
  }
  return { stage: "preboot", restored: false };
}

export function useBootFlow(callbacks: {
  onLoginComplete: () => void;
  onLogOff: () => void;
}) {
  const [initial] = useState(resolveInitialBoot);
  const [stage, setStage] = useState<Stage>(initial.stage);
  const [bootRun, setBootRun] = useState(0);
  const [bootDelayVisible, setBootDelayVisible] = useState(false);
  /** Black crossfade overlay between boot and login. */
  const [fadeoutOverlay, setFadeoutOverlay] = useState<"hidden" | "in" | "out">("hidden");
  /** Login chrome (center columns + corners) fades out 160ms after tile click. */
  const [loginChromeFading, setLoginChromeFading] = useState(false);
  /** Welcome message .visible class (fades opacity in over 0.7s). */
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [shutdownText, setShutdownText] = useState("Logging off...");
  const [logoffDialog, setLogoffDialog] = useState<LogoffDialogType | null>(null);

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const timersRef = useRef<number[]>([]);
  const loginBusyRef = useRef(false);
  const notifiedRef = useRef(false);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearScheduled = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const notifyLoginComplete = useCallback(() => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    callbacksRef.current.onLoginComplete();
  }, []);

  // Audio unlock gestures are bound as soon as the boot flow initializes.
  useEffect(() => {
    bindAudioUnlockGestures();
  }, []);

  // Mobile devices get a single-column login layout via html.mobile-device.
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const apply = () => document.documentElement.classList.toggle("mobile-device", query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => {
      query.removeEventListener("change", apply);
      document.documentElement.classList.remove("mobile-device");
    };
  }, []);

  // Session restore: skip boot + login entirely, land on the desktop.
  useEffect(() => {
    if (initial.restored) notifyLoginComplete();
  }, [initial.restored, notifyLoginComplete]);

  // Full boot sequence. Re-runs whenever `bootRun` increments (login-screen restart).
  useEffect(() => {
    if (initial.restored && bootRun === 0) return;

    let cancelled = false;
    let gateA = false;
    let loadedCount = 0;
    let assetsReady = false;

    BOOT_PRELOAD_IMAGES.forEach((src) => {
      const img = new Image();
      const done = () => {
        loadedCount += 1;
        if (loadedCount === BOOT_PRELOAD_IMAGES.length) assetsReady = true;
      };
      img.onload = done;
      img.onerror = done;
      img.src = src;
    });

    const finishBoot = () => {
      if (cancelled) return;
      setBootDelayVisible(false);
      setStage("boot-out");
      schedule(() => setFadeoutOverlay("in"), FADEOUT_OVERLAY_IN_MS);
      schedule(() => {
        setStage("login");
        setFadeoutOverlay("out");
      }, FADEOUT_OVERLAY_IN_MS + FADEOUT_TO_LOGIN_MS);
      schedule(
        () => setFadeoutOverlay("hidden"),
        FADEOUT_OVERLAY_IN_MS + FADEOUT_TO_LOGIN_MS + FADEOUT_OVERLAY_OUT_MS,
      );
    };

    schedule(() => setStage("boot"), PREBOOT_MS);
    schedule(() => {
      gateA = true;
    }, PREBOOT_MS + BOOT_MIN_MS);

    const poll = window.setInterval(() => {
      if (cancelled) return;
      if (gateA && assetsReady) {
        window.clearInterval(poll);
        finishBoot();
      } else if (gateA) {
        setBootDelayVisible(true);
      }
    }, BOOT_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      clearScheduled();
    };
  }, [bootRun, initial.restored, schedule, clearScheduled]);

  // User tile click → welcome → desktop.
  const performLogin = useCallback(() => {
    if (loginBusyRef.current) return;
    loginBusyRef.current = true;
    unlockAudio();
    setStage("login-fade");
    schedule(() => setLoginChromeFading(true), LOGIN_FADE_MS);
    schedule(() => {
      setStage("welcome");
      // Next frame so the display change lands before the opacity fade-in.
      requestAnimationFrame(() => setWelcomeVisible(true));
    }, LOGIN_WELCOME_MS);
    schedule(() => {
      setWelcomeVisible(false);
      try {
        window.sessionStorage.setItem("logged_in", "true");
      } catch {
        // non-fatal
      }
      void playStingAndWait("login", LOGIN_STING_MAX_MS); // fire-and-forget
      notifyLoginComplete();
      setStage("desktop");
    }, LOGIN_DONE_MS);
  }, [schedule, notifyLoginComplete]);

  // "Restart MaxXP" on the login screen: full boot replays.
  const restartFromLogin = useCallback(() => {
    try {
      window.sessionStorage.removeItem("logged_in");
    } catch {
      // non-fatal
    }
    clearScheduled();
    loginBusyRef.current = false;
    setLoginChromeFading(false);
    setWelcomeVisible(false);
    setFadeoutOverlay("hidden");
    setBootDelayVisible(false);
    setStage("preboot");
    setBootRun((run) => run + 1);
  }, [clearScheduled]);

  const requestLogoffDialog = useCallback((type: LogoffDialogType) => {
    setLogoffDialog(type);
  }, []);

  const closeLogoffDialog = useCallback(() => {
    setLogoffDialog(null);
  }, []);

  // Grayscale the rest of the screen 700ms after the dialog opens; Escape closes.
  useEffect(() => {
    if (!logoffDialog) {
      document.body.classList.remove("screen-grayscale-active");
      return;
    }
    const id = window.setTimeout(
      () => document.body.classList.add("screen-grayscale-active"),
      GRAYSCALE_DELAY_MS,
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLogoffDialog(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("screen-grayscale-active");
    };
  }, [logoffDialog]);

  // "Log Off" confirm: back to a pristine login screen, no reload.
  const confirmLogOff = useCallback(() => {
    playSfx("logoff");
    setLogoffDialog(null);
    callbacksRef.current.onLogOff();
    try {
      window.sessionStorage.removeItem("logged_in");
    } catch {
      // non-fatal
    }
    clearScheduled();
    loginBusyRef.current = false;
    setLoginChromeFading(false);
    setWelcomeVisible(false);
    setShutdownText("Logging off...");
    setStage("login");
  }, [clearScheduled]);

  // "Restart" confirm: shutdown sting + shutdown screen, then reload.
  const confirmRestart = useCallback(() => {
    setLogoffDialog(null);
    const sting = playStingAndWait("shutdown", SHUTDOWN_STING_MAX_MS); // fire-and-forget
    try {
      window.sessionStorage.removeItem("logged_in");
    } catch {
      // non-fatal
    }
    clearScheduled();
    loginBusyRef.current = false;
    setLoginChromeFading(false);
    setWelcomeVisible(false);
    setShutdownText("Logging off...");
    setStage("shutdown");
    schedule(() => {
      setShutdownText(`${APP_NAME} is shutting down...`);
      // Reload after the sting ends or SHUTDOWN_MIN_MS, whichever is later
      // (the sting itself is capped at SHUTDOWN_STING_MAX_MS from t=0).
      const hold = new Promise<void>((resolve) => {
        window.setTimeout(resolve, SHUTDOWN_MIN_MS);
      });
      Promise.all([sting, hold])
        .then(() => window.location.reload())
        .catch(() => window.location.reload());
    }, SHUTDOWN_TEXT_SWAP_MS);
  }, [schedule, clearScheduled]);

  // All timers die with the component.
  useEffect(() => clearScheduled, [clearScheduled]);

  const phase = phaseForStage(stage);

  return {
    phase,
    requestLogoffDialog,
    logoffDialog,
    closeLogoffDialog,
    // Internal view model consumed by <BootScreens flow={…} />.
    view: {
      stage,
      bootDelayVisible,
      fadeoutOverlay,
      loginChromeFading,
      welcomeVisible,
      shutdownText,
      performLogin,
      restartFromLogin,
      confirmLogOff,
      confirmRestart,
    },
  };
}

export type BootFlow = ReturnType<typeof useBootFlow>;

function UserAvatar() {
  return (
    <div className="user">
      <div className="user-avatar" aria-hidden="true">
        M
      </div>
    </div>
  );
}

export function BootScreens({ flow }: { flow: BootFlow }): JSX.Element | null {
  const { view, logoffDialog } = flow;

  if (view.stage === "desktop" && !logoffDialog) return null;

  const showBoot = view.stage === "boot" || view.stage === "boot-out";
  const showLogin =
    view.stage === "login" ||
    view.stage === "login-fade" ||
    view.stage === "welcome" ||
    view.stage === "shutdown";
  const isShuttingDown = view.stage === "shutdown";
  const loginChromeHidden = view.stage === "welcome";
  const tileActive = view.stage === "login-fade" || view.stage === "welcome";

  const chromeClass = cn(
    view.loginChromeFading && "login-chrome-fading",
    loginChromeHidden && "login-chrome-hidden",
  );

  return (
    <>
      {view.stage === "preboot" && (
        <div className="pre-boot-overlay-style" id="pre-boot-overlay" />
      )}

      {showBoot && (
        <div
          id="boot-screen"
          className={cn(
            view.stage === "boot" && "boot-fade-in",
            view.stage === "boot-out" && "fading-out",
          )}
        >
          <div className="loading-container">
            <img
              id="boot-logo"
              src={`${xp}/gui/boot/xp-logo.webp`}
              alt="Windows XP Loading"
              draggable={false}
            />
            <div className="container" aria-hidden="true">
              <div className="box" />
              <div className="box" />
              <div className="box" />
            </div>
          </div>
          <div
            id="boot-delay-message"
            className={cn(view.bootDelayVisible && "is-visible")}
          >
            Still booting... hang tight.
          </div>
          <div className="boot-bottom-left">
            <span>For the best experience</span>
            <span>Enter Full Screen (F11)</span>
          </div>
          <div className="boot-bottom-right">
            <img
              src={`${xp}/gui/boot/boot-wordmark.webp`}
              alt="Boot Wordmark"
              draggable={false}
              decoding="async"
            />
          </div>
        </div>
      )}

      {view.fadeoutOverlay !== "hidden" && (
        <div
          id="boot-fadeout-overlay"
          className={cn(
            "boot-fadeout-overlay-style",
            view.fadeoutOverlay === "in" && "is-visible",
          )}
        />
      )}

      {showLogin && (
        <div id="login-screen">
          <div
            className={cn(
              "login-screen",
              isShuttingDown ? "is-shutting-down" : "login-screen-initial-display",
            )}
          >
            <div className="login-screen-inner">
              <div className={cn("login-screen-center", !isShuttingDown && chromeClass)}>
                <div className="left">
                  <img
                    className="xp-logo-image"
                    src={`${xp}/gui/boot/xp-logo.webp`}
                    alt="Windows XP Loading"
                    draggable={false}
                  />
                  <div className="left-text">
                    {isShuttingDown ? (
                      <span className="desktop-login-instruction">{view.shutdownText}</span>
                    ) : (
                      <>
                        <span className="desktop-login-instruction">
                          To begin, click on{" "}
                          <span className="login-instruction-name">{portfolio.name}</span>{" "}
                          to log in
                        </span>
                        <span className="mobile-login-instruction">
                          Tap on the user icon to begin
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <hr className="login-separator mobile-only" />
                <div className="login-divider" aria-hidden="true" />
                <div className="right">
                  <div
                    className={cn("interactive back-gradient", tileActive && "active")}
                    role="button"
                    tabIndex={0}
                    aria-label={`Log in as ${portfolio.name}`}
                    onPointerDown={(event) => {
                      if (event.isPrimary === false) return;
                      if (event.pointerType === "mouse" && event.button !== 0) return;
                      view.performLogin();
                    }}
                    onClick={() => view.performLogin()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        view.performLogin();
                      }
                    }}
                  >
                    <UserAvatar />
                    <div className="text-wrap">
                      <div className="name">{portfolio.name}</div>
                      <div className="user-title">{portfolio.title}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {!isShuttingDown && (
              <>
                <div
                  className={cn("turn-off", chromeClass)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Restart ${APP_NAME}`}
                  onClick={() => view.restartFromLogin()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      view.restartFromLogin();
                    }
                  }}
                >
                  <img
                    id="shutdown-icon"
                    src={`${xp}/gui/system/restart.webp`}
                    alt="Restart"
                    draggable={false}
                  />
                  <div className="shutdown-text" id="shutdown-text">
                    Restart {APP_NAME}
                  </div>
                </div>
                <div className={cn("right-bottom", chromeClass)}>
                  <span className="desktop-bottom-detail" data-nosnippet="">
                    After you log on, the system&apos;s yours to explore.
                  </span>
                  <span className="desktop-bottom-detail" data-nosnippet="">
                    Every window is wired to real portfolio content.
                  </span>
                  <span className="mobile-bottom-detail" data-nosnippet="">
                    Tap on the user icon to begin
                  </span>
                </div>
              </>
            )}
            {isShuttingDown && (
              <div className="right-bottom is-shutdown-detail">
                <span className="mobile-bottom-detail" data-nosnippet="">
                  {APP_NAME} is restarting
                </span>
              </div>
            )}
          </div>
          <div
            className={cn(
              "welcome-message",
              view.stage === "welcome" ? null : "welcome-message-initial-hidden",
              view.welcomeVisible && "visible",
            )}
          >
            <span className="welcome-image-fallback">welcome</span>
          </div>
        </div>
      )}

      {logoffDialog && (
        <div
          id="logoff-dialog-container"
          className="visible"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logoff-dialog-title"
        >
          <div className="logoff-dialog">
            <div className="logoff-dialog-body">
              <div className="logoff-dialog-header-content">
                <img
                  className="logoff-dialog-header-icon"
                  src={`${xp}/gui/system/windows-flag.webp`}
                  alt=""
                  draggable={false}
                  decoding="async"
                  width={32}
                  height={32}
                />
                <span className="logoff-dialog-header-text" id="logoff-dialog-title">
                  {logoffDialog === "logOff" ? `Log Off ${APP_NAME}` : `Turn off ${APP_NAME}`}
                </span>
              </div>
              <div className="logoff-dialog-separator-bar logoff-dialog-separator-bar-top" />
              <div className="logoff-dialog-button-container">
                <div
                  className="logoff-dialog-button"
                  id="logoff-switch-user-btn"
                  role="button"
                  tabIndex={0}
                  aria-label="Restart Computer"
                  onClick={(event) => {
                    event.stopPropagation();
                    view.confirmRestart();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      view.confirmRestart();
                    }
                  }}
                >
                  <img
                    src={`${xp}/gui/system/restart.webp`}
                    alt="Restart Icon"
                    draggable={false}
                    width={22}
                    height={22}
                  />
                  <span>Restart</span>
                </div>
                <div
                  className="logoff-dialog-button"
                  id="logoff-log-off-btn"
                  role="button"
                  tabIndex={logoffDialog === "shutDown" ? -1 : 0}
                  aria-label={logoffDialog === "logOff" ? "Log Off User" : "Shut Down Computer"}
                  aria-disabled={logoffDialog === "shutDown"}
                  style={
                    logoffDialog === "shutDown"
                      ? { opacity: 0.6, pointerEvents: "none" }
                      : undefined
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    if (logoffDialog === "shutDown") return;
                    view.confirmLogOff();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      if (logoffDialog === "shutDown") return;
                      view.confirmLogOff();
                    }
                  }}
                >
                  <img
                    src={
                      logoffDialog === "logOff"
                        ? `${xp}/gui/system/logoff.webp`
                        : `${xp}/gui/system/shutdown.webp`
                    }
                    alt={logoffDialog === "logOff" ? "Log Off Icon" : "Shut Down Icon"}
                    draggable={false}
                    width={22}
                    height={22}
                  />
                  <span>{logoffDialog === "logOff" ? "Log Off" : "Shut Down"}</span>
                </div>
              </div>
              <div className="logoff-dialog-separator-bar logoff-dialog-separator-bar-bottom">
                <div className="logoff-dialog-footer">
                  <button
                    type="button"
                    id="logoff-cancel-btn"
                    aria-label="Cancel Log Off"
                    style={{ userSelect: "none" }}
                    onClick={() => flow.closeLogoffDialog()}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
