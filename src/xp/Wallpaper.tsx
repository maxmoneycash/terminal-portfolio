/**
 * One animated background, kept mounted so pausing retains the current frame.
 * Posters come from the loop itself; the stock XP photograph is not used.
 * Auto follows reduced-motion and Save-Data; an explicit on/off choice wins.
 */
import { useEffect, useRef, useState } from "react";

const POSTER_LANDSCAPE = "/xp/video/bliss-loop-landscape.webp";
const POSTER_PORTRAIT = "/xp/video/bliss-loop-portrait.webp";
const LOOP_LANDSCAPE = "/xp/video/bliss-loop-landscape.mp4";
const LOOP_PORTRAIT = "/xp/video/bliss-loop-portrait.mp4";

const STORAGE_KEY = "maxxp:wallpaper-motion";
const PAPER_KEY = "maxxp:wallpaper-paper";

export type WallpaperMotion = "auto" | "on" | "off";
/** Which paper is on the desktop: Bliss, or none (the XP solid teal). */
export type WallpaperPaper = "bliss" | "none";

let motionPref: WallpaperMotion = readStoredMotion();
const motionListeners = new Set<(pref: WallpaperMotion) => void>();

let paperPref: WallpaperPaper = readStoredPaper();
const paperListeners = new Set<(paper: WallpaperPaper) => void>();

function readStoredPaper(): WallpaperPaper {
  try {
    if (window.localStorage.getItem(PAPER_KEY) === "none") return "none";
  } catch {
    // Storage optional.
  }
  return "bliss";
}

export function getWallpaperPaper() {
  return paperPref;
}

export function setWallpaperPaper(paper: WallpaperPaper) {
  paperPref = paper;
  try {
    if (paper === "bliss") window.localStorage.removeItem(PAPER_KEY);
    else window.localStorage.setItem(PAPER_KEY, paper);
  } catch {
    // Storage optional.
  }
  paperListeners.forEach((listener) => listener(paper));
}

export function subscribeWallpaperPaper(listener: (paper: WallpaperPaper) => void) {
  paperListeners.add(listener);
  return () => {
    paperListeners.delete(listener);
  };
}

function readStoredMotion(): WallpaperMotion {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "on" || stored === "off") return stored;
  } catch {
    // Storage is optional.
  }
  return "auto";
}

export function getWallpaperMotion() {
  return motionPref;
}

export function setWallpaperMotion(pref: WallpaperMotion) {
  motionPref = pref;
  try {
    if (pref === "auto") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Storage is optional.
  }
  motionListeners.forEach((listener) => listener(pref));
}

export function subscribeWallpaperMotion(listener: (pref: WallpaperMotion) => void) {
  motionListeners.add(listener);
  return () => {
    motionListeners.delete(listener);
  };
}

/** Whether the loop should play right now, given the preference and environment. */
export function shouldAnimateWallpaper(pref: WallpaperMotion) {
  if (pref === "on") return true;
  if (pref === "off") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData !== true;
}

export function Wallpaper({ active = true }: { active?: boolean }) {
  const [visible, setVisible] = useState(!document.hidden);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const sync = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  const [portrait, setPortrait] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(orientation: portrait)").matches,
  );
  const [pref, setPref] = useState<WallpaperMotion>(getWallpaperMotion);
  const [paper, setPaper] = useState<WallpaperPaper>(getWallpaperPaper);
  const [animate, setAnimate] = useState(() => shouldAnimateWallpaper(getWallpaperMotion()));

  useEffect(() => subscribeWallpaperMotion(setPref), []);
  useEffect(() => subscribeWallpaperPaper(setPaper), []);

  useEffect(() => {
    const orientation = window.matchMedia("(orientation: portrait)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setPortrait(orientation.matches);
      setAnimate(shouldAnimateWallpaper(pref));
    };
    sync();
    orientation.addEventListener("change", sync);
    motion.addEventListener("change", sync);
    return () => {
      orientation.removeEventListener("change", sync);
      motion.removeEventListener("change", sync);
    };
  }, [pref]);

  const poster = portrait ? POSTER_PORTRAIT : POSTER_LANDSCAPE;
  const loop = portrait ? LOOP_PORTRAIT : LOOP_LANDSCAPE;
  const shouldPlay = animate && active && visible && paper !== "none";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (shouldPlay) void video.play().catch(() => {});
    else video.pause();
    return () => video.pause();
  }, [shouldPlay, loop, paper]);

  if (paper === "none") {
    // XP's "(None)" wallpaper: the default Luna desktop teal.
    return (
      <div className="xp-wallpaper is-solid" aria-hidden="true">
        <div className="xp-wallpaper-grade" />
      </div>
    );
  }

  return (
    <div className="xp-wallpaper" aria-hidden="true">
      <video
        ref={videoRef}
        key={loop}
        className="xp-wallpaper-loop"
        src={loop}
        poster={poster}
        muted
        loop
        playsInline
        preload={shouldPlay ? "auto" : "metadata"}
        onCanPlay={(event) => {
          if (shouldPlay) void event.currentTarget.play().catch(() => {});
        }}
      />
      <div className="xp-wallpaper-grade" />
    </div>
  );
}
