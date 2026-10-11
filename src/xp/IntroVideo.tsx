/**
 * The MaxXP intro film: the quill writes over banknotes, the KK6OQA radio sends the
 * callsign in Morse, then the work plays out best first and ever faster until
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
import { LoadingMontage } from "../intro/LoadingMontage";
import { OPENING_SECONDS } from "../intro/BanknoteOpening";

const INTRO = {
  portrait: {
    orient: "portrait",
    src: "/videos/intro/intro-portrait-b4cb73d2.mp4",
    poster: "/videos/intro/intro-portrait-b4cb73d2.jpg",
  },
  landscape: {
    orient: "landscape",
    src: "/videos/intro/intro-landscape-12a8c08b.mp4",
    poster: "/videos/intro/intro-landscape-12a8c08b.jpg",
  },
};

/** Offer a retry after a slow start; never silently dismiss the film. */
const STALL_MS = 8000;
const SKIP_REVEAL_MS = 900;

type Playback = "loading" | "playing" | "manual" | "paused" | "buffering" | "error";

function timeLabel(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function pickSource() {
  try {
    return window.innerHeight > window.innerWidth ? INTRO.portrait : INTRO.landscape;
  } catch {
    return INTRO.landscape;
  }
}

/** Let visitors who prefer less motion or data choose when to start. */
function prefersManualPlay() {
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
  const [manualPreference] = useState(() => !requested && prefersManualPlay());
  const [openingStart, setOpeningStart] = useState(() => performance.now());
  const [started, setStarted] = useState(false);
  const [openingDone, setOpeningDone] = useState(false);
  const [muted, setMuted] = useState(true);
  const [skipVisible, setSkipVisible] = useState(false);
  const [playback, setPlayback] = useState<Playback>("loading");
  const [slow, setSlow] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const regionRef = useRef<HTMLDivElement | null>(null);
  const finishedRef = useRef(false);
  const joinedOpening = useRef(false);
  const lastPosition = useRef(0);
  const restorePosition = useRef<number | null>(null);

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
    let cancelled = false;
    if (manualPreference) {
      setPlayback("manual");
      return;
    }
    const playMuted = () => {
      video.muted = true;
      setMuted(true);
      // iOS Low Power Mode can refuse even muted autoplay. Keep the film
      // available, with an explicit user-gesture play button.
      void video.play().catch((error: DOMException) => {
        if (!cancelled && error.name !== "AbortError") setPlayback(video.error ? "error" : "manual");
      });
    };
    // Sound follows the tray volume; the browser may still insist on muted.
    const volume = getSystemVolume() / 100;
    if (volume === 0) {
      playMuted();
      return () => { cancelled = true; };
    }
    video.volume = volume;
    video.muted = false;
    void video.play().then(() => { if (!cancelled) setMuted(false); }, (error: DOMException) => {
      if (!cancelled && error.name !== "AbortError") playMuted();
    });
    return () => { cancelled = true; };
  }, [manualPreference, finish]);

  const unmute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0.5, getSystemVolume() / 100);
    video.muted = false;
    void video.play().catch((error: DOMException) => {
      if (!finishedRef.current && error.name !== "AbortError") setPlayback(video.error ? "error" : "manual");
    });
    setMuted(false);
  }, []);

  const play = useCallback((reload = false) => {
    const video = videoRef.current;
    if (!video) return;
    if (!started) {
      setOpeningStart(performance.now());
      // A deliberate Play starts at the beginning. Never chase the loading
      // montage's clock through a series of seeks on a slow connection.
      joinedOpening.current = true;
    }
    if (video.error || reload) {
      restorePosition.current = lastPosition.current;
      video.load();
    }
    setSlow(false);
    setPlayback("loading");
    regionRef.current?.focus({ preventScroll: true });
    unmute();
  }, [unmute, started]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.error) play();
    else video.pause();
  }, [play]);

  useEffect(() => {
    const id = window.setTimeout(() => setSkipVisible(true), SKIP_REVEAL_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    // Space should operate playback, not activate a preselected Skip button.
    regionRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    setSlow(false);
    if (playback !== "loading" && playback !== "buffering") return;
    const id = window.setTimeout(() => setSlow(true), STALL_MS);
    return () => window.clearTimeout(id);
  }, [playback]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finish]);

  useEffect(() => {
    const sync = () => {
      const video = videoRef.current;
      if (!document.hidden && video && !finishedRef.current && !video.ended && video.paused) {
        setPlayback(video.error ? "error" : started ? "paused" : "manual");
      }
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, [started]);

  const needsPlay = playback === "manual" || playback === "paused" || playback === "error";
  const waiting = playback === "buffering" || playback === "loading";

  return (
    <div
      ref={regionRef}
      className={cn("intro", `is-${source.orient}`, !openingDone && "is-opening", fading && `is-fading-${fading}`)}
      role="region"
      aria-label="MaxXP intro"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          togglePlayback();
        }
      }}
      onClick={() => {
        if (needsPlay) play();
        else if (muted) unmute();
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
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setDuration(video.duration);
          if (restorePosition.current !== null) {
            video.currentTime = restorePosition.current;
            restorePosition.current = null;
          }
        }}
        onPlaying={() => {
          // Metadata can arrive long before playable frames. Join the live
          // artwork only once playback is ready, including after a slow seek.
          const video = videoRef.current;
          if (video && !manualPreference && !joinedOpening.current) {
            joinedOpening.current = true;
            const join = Math.min(OPENING_SECONDS, (performance.now() - openingStart) / 1000);
            if (join - video.currentTime > 0.1) {
              video.currentTime = join;
              return;
            }
          }
          setStarted(true);
          setPlayback("playing");
          setSlow(false);
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          // load() resets currentTime before loadedmetadata restores it.
          if (restorePosition.current === null) {
            lastPosition.current = video.currentTime;
            setPosition(video.currentTime);
          }
          if (video.currentTime >= OPENING_SECONDS) setOpeningDone(true);
          if (!video.paused && video.readyState >= 3 && started) setPlayback("playing");
        }}
        onPause={(event) => {
          if (!finishedRef.current && !event.currentTarget.ended) setPlayback(started ? "paused" : "manual");
        }}
        onWaiting={() => { if (!finishedRef.current) setPlayback(started ? "buffering" : "loading"); }}
        onStalled={(event) => {
          if (!finishedRef.current && event.currentTarget.readyState < 3) setPlayback(started ? "buffering" : "loading");
        }}
        onEnded={() => finish("ended")}
        onError={() => setPlayback("error")}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        aria-hidden="true"
      />
      {!started ? <LoadingMontage startedAt={openingStart} still={needsPlay} portrait={source.orient === "portrait"} /> : null}
      {needsPlay || (waiting && slow) ? (
        <div className="intro-play-prompt">
          {playback === "error" ? <p>Playback was interrupted. Retry from here.</p> : waiting ? <p role="status">Still loading the film…</p> : null}
          <button type="button" className="xp-control" onClick={(event) => { event.stopPropagation(); play(waiting); }}>
            {playback === "error" || waiting ? "Retry playback" : started ? "Resume intro" : "Play intro"}
          </button>
        </div>
      ) : null}
      {started ? (
        <div className="intro-controls" role="group" aria-label="Intro playback" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={togglePlayback} aria-label={needsPlay ? "Resume intro" : "Pause intro"}>
            {needsPlay ? "Play" : "Pause"}
          </button>
          <button type="button" onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            if (video.muted) unmute();
            else video.muted = true;
          }} aria-label={muted ? "Turn sound on" : "Mute intro"}>
            {muted ? "Sound off" : "Sound on"}
          </button>
          <span className="intro-time" aria-label="Playback time">{timeLabel(position)} / {timeLabel(duration)}</span>
        </div>
      ) : null}
      <button
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
