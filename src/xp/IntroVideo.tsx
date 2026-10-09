/**
 * The MaxXP intro film: XP boots, logs in, and the projects play out through
 * Notepad, Internet Explorer, balloon tips and dialogs until every window
 * closes on the live desktop. It hands off directly to the interactive desktop.
 *
 * Rendered by intro-film/ (Remotion) from the original project recordings.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { getSystemVolume } from "./audio";

const INTRO = {
  portrait: {
    orient: "portrait",
    src: "/videos/intro/intro-portrait-97e3668c.mp4",
    poster: "/videos/intro/intro-portrait-97e3668c.jpg",
  },
  landscape: {
    orient: "landscape",
    src: "/videos/intro/intro-landscape-91531726.mp4",
    poster: "/videos/intro/intro-landscape-91531726.jpg",
  },
};

/** If playback hasn't started by now (slow network), open the desktop. */
const STALL_MS = 8000;
const SKIP_REVEAL_MS = 900;

function pickSource() {
  try {
    return window.innerHeight > window.innerWidth ? INTRO.portrait : INTRO.landscape;
  } catch {
    return INTRO.landscape;
  }
}

/** Visitors who asked for less motion or less data skip an intro they didn't request. */
function prefersSkip() {
  try {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    return Boolean(saveData) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export type IntroEnd = "ended" | "skipped";

/**
 * `requested` means the visitor clicked Watch intro: the film plays even
 * with reduced motion, and with its XP sounds when the browser allows.
 */
export function IntroVideo({ onFinish, fading, requested = false }: {
  onFinish: (how: IntroEnd) => void;
  fading: IntroEnd | null;
  requested?: boolean;
}) {
  const [source] = useState(pickSource);
  const [started, setStarted] = useState(false);
  const [skipVisible, setSkipVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const skipRef = useRef<HTMLButtonElement | null>(null);
  const finishedRef = useRef(false);

  const finish = useCallback(
    (how: IntroEnd = "skipped") => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      videoRef.current?.pause();
      onFinish(how);
    },
    [onFinish],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!requested && prefersSkip()) {
      finish();
      return;
    }
    const playMuted = () => {
      video.muted = true;
      // Autoplay refused (e.g. iOS Low Power Mode): go straight to the desktop.
      video.play().catch(() => finish());
    };
    // Sound follows the tray volume; the browser may still insist on muted.
    const volume = getSystemVolume() / 100;
    if (!requested || volume === 0) {
      playMuted();
      return;
    }
    video.volume = volume;
    video.muted = false;
    video.play().catch(playMuted);
  }, [requested, finish]);

  useEffect(() => {
    const id = window.setTimeout(() => setSkipVisible(true), SKIP_REVEAL_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    skipRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (started) return;
    const id = window.setTimeout(() => finish(), STALL_MS);
    return () => window.clearTimeout(id);
  }, [started, finish]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finish]);

  return (
    <div
      className={cn("intro", fading && `is-fading-${fading}`)}
      role="region"
      aria-label="MaxXP intro"
      onClick={() => finish()}
    >
      <video
        ref={videoRef}
        className={cn("intro-video", `is-${source.orient}`)}
        src={source.src}
        poster={source.poster}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        onPlaying={() => setStarted(true)}
        onEnded={() => finish("ended")}
        onError={() => finish()}
        aria-hidden="true"
      />
      <button
        ref={skipRef}
        type="button"
        className={cn("intro-skip", skipVisible && "is-visible")}
        onClick={(event) => {
          event.stopPropagation();
          finish();
        }}
      >
        Skip intro <span aria-hidden="true">»</span>
      </button>
    </div>
  );
}
