/**
 * The MaxXP intro film: the quill writes the name, the KK6OQA radio sends the
 * greeting in Morse, then the work plays out best first and ever faster until
 * every window minimizes on the live desktop. It hands off directly to the
 * interactive desktop.
 *
 * It plays with sound whenever the browser allows; otherwise it starts muted
 * and a click or tap anywhere turns the sound on. Only Skip or Escape leaves.
 *
 * Rendered by intro-film/ (Remotion) from the original project recordings.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { getSystemVolume } from "./audio";

const INTRO = {
  portrait: {
    orient: "portrait",
    src: "/videos/intro/intro-portrait-72311d5a.mp4",
    poster: "/videos/intro/intro-portrait-72311d5a.jpg",
  },
  landscape: {
    orient: "landscape",
    src: "/videos/intro/intro-landscape-89cc07ea.mp4",
    poster: "/videos/intro/intro-landscape-89cc07ea.jpg",
  },
};

/** If playback hasn't started by now (slow network), open the desktop. */
const STALL_MS = 8000;
const SKIP_REVEAL_MS = 900;
/** How long the "Click for sound" hint stays up once the film starts. */
const SOUND_HINT_MS = 3000;

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
  const [muted, setMuted] = useState(true);
  const [skipVisible, setSkipVisible] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
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
      setMuted(true);
      // Autoplay refused (e.g. iOS Low Power Mode): go straight to the desktop.
      video.play().catch(() => finish());
    };
    // Sound follows the tray volume; the browser may still insist on muted.
    const volume = getSystemVolume() / 100;
    if (volume === 0) {
      playMuted();
      return;
    }
    video.volume = volume;
    video.muted = false;
    video.play().then(() => setMuted(false), playMuted);
  }, [requested, finish]);

  const unmute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0.5, getSystemVolume() / 100);
    video.muted = false;
    void video.play().catch(() => {});
    setMuted(false);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setSkipVisible(true), SKIP_REVEAL_MS);
    return () => window.clearTimeout(id);
  }, []);

  // The sound hint shows briefly once the film is moving, then gets out of the way.
  useEffect(() => {
    if (!started) return;
    const id = window.setTimeout(() => setHintVisible(false), SOUND_HINT_MS);
    return () => window.clearTimeout(id);
  }, [started]);

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
      className={cn("intro", `is-${source.orient}`, fading && `is-fading-${fading}`)}
      role="region"
      aria-label="MaxXP intro"
      onClick={() => {
        if (muted) unmute();
      }}
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
      {muted && started ? (
        <p className={cn("intro-sound", hintVisible && "is-visible")} aria-live="polite">
          <img src="/xp/gui/tray/volume.webp" alt="" width={12} height={12} />
          Click for sound
        </p>
      ) : null}
      <button
        ref={skipRef}
        type="button"
        className={cn("intro-skip", skipVisible && "is-visible")}
        onClick={(event) => {
          event.stopPropagation();
          finish();
        }}
      >
        Skip
      </button>
    </div>
  );
}
