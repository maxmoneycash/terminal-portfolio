/**
 * The MaxXP intro: a phone filming an XP monitor as windows pop open, each
 * playing a project from the demo reel. It stands in for the boot screen and
 * hands off to the login screen, which is also the video's final shot.
 *
 * Rendered by scripts/intro (make_screen.py, then scene.py in Blender).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

const INTRO = {
  portrait: {
    orient: "portrait",
    src: "/videos/intro/intro-portrait-ecc42879.mp4",
    poster: "/videos/intro/intro-portrait-ecc42879.jpg",
  },
  landscape: {
    orient: "landscape",
    src: "/videos/intro/intro-landscape-32c8272f.mp4",
    poster: "/videos/intro/intro-landscape-32c8272f.jpg",
  },
};

/** If playback hasn't started by now (slow network), go on to the login screen. */
const STALL_MS = 8000;
const SKIP_REVEAL_MS = 900;

function pickSource() {
  try {
    return window.innerHeight > window.innerWidth ? INTRO.portrait : INTRO.landscape;
  } catch {
    return INTRO.landscape;
  }
}

/** Visitors who asked for less motion or less data get a still frame and a Play button. */
function prefersStill() {
  try {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    return Boolean(saveData) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export type IntroEnd = "ended" | "skipped";

export function IntroVideo({ onFinish, fading }: { onFinish: (how: IntroEnd) => void; fading: IntroEnd | null }) {
  const [source] = useState(pickSource);
  const [still] = useState(prefersStill);
  const [waitingForPlay, setWaitingForPlay] = useState(still);
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

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.play().then(
      () => setWaitingForPlay(false),
      // Autoplay refused (e.g. iOS Low Power Mode): offer the Play button.
      () => setWaitingForPlay(true),
    );
  }, []);

  useEffect(() => {
    if (!still) play();
  }, [still, play]);

  useEffect(() => {
    const id = window.setTimeout(() => setSkipVisible(true), SKIP_REVEAL_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    skipRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (waitingForPlay || started) return;
    const id = window.setTimeout(() => finish(), STALL_MS);
    return () => window.clearTimeout(id);
  }, [waitingForPlay, started, finish]);

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
      onClick={() => {
        if (!waitingForPlay) finish();
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
      {waitingForPlay ? (
        <button
          type="button"
          className="intro-play"
          onClick={(event) => {
            event.stopPropagation();
            play();
          }}
        >
          <span className="intro-play-glass" aria-hidden="true" />
          <span className="intro-play-label">Play intro</span>
        </button>
      ) : null}
      <button
        ref={skipRef}
        type="button"
        className={cn("intro-skip", (skipVisible || waitingForPlay) && "is-visible")}
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
