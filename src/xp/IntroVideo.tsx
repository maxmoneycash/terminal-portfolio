/** The intro's XP desktop is composed at the viewport's actual aspect ratio. */
import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { CallbackListener, PlayerRef } from "@remotion/player";
import { cn } from "../lib/cn";
import { getSystemVolume } from "./audio";
import { LoadingMontage } from "../intro/LoadingMontage";
import { OPENING_FRAMES } from "../intro/BanknoteOpening";

const ResponsiveFilm = lazy(() => import("../intro/ResponsiveFilm"));
type Playback = "loading" | "playing" | "manual" | "paused" | "buffering" | "error";
export type IntroEnd = "ended" | "skipped";

class FilmBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function IntroVideo({ onFinish, fading, requested = false }: {
  onFinish: (how: IntroEnd) => void; fading: IntroEnd | null; requested?: boolean;
}) {
  const region = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [manualPreference] = useState(() => !requested && (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)));
  const [mobile] = useState(() => window.innerWidth < 1000 || window.innerHeight > window.innerWidth ||
    Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData));
  const [player, setPlayer] = useState<PlayerRef | null>(null);
  const [playback, setPlayback] = useState<Playback>(manualPreference ? "manual" : "loading");
  const [frame, setFrame] = useState(0);
  const [started, setStarted] = useState(false);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [inkReady, setInkReady] = useState(false);
  const openingFrame = useRef(0);
  const inkLoaded = useCallback(() => setInkReady(true), []);
  const openingTick = useCallback((value: number) => { openingFrame.current = value; }, []);
  const [volume] = useState(() => getSystemVolume() / 100);
  const [skipVisible, setSkipVisible] = useState(false);
  const lastFrame = useRef(0);
  const finished = useRef(false);
  const userStarted = useRef(requested);
  const initialFrame = useRef(0);
  const portrait = viewport.height > viewport.width;
  const needsPlay = playback === "manual" || playback === "paused" || playback === "error";
  const waiting = playback === "loading" || playback === "buffering";

  const finish = useCallback((how: IntroEnd = "skipped") => {
    if (finished.current) return;
    finished.current = true;
    player?.pause();
    onFinish(how);
  }, [onFinish, player]);
  const fail = useCallback(() => setPlayback("error"), []);

  useEffect(() => {
    const element = region.current;
    if (!element) return;
    element.focus({ preventScroll: true });
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) setViewport({ width, height });
    });
    observer.observe(element);
    const timer = window.setTimeout(() => setSkipVisible(true), 900);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!player || !inkReady) return;
    const playing = () => { setStarted(true); setPlayback("playing"); };
    const paused = () => { if (!finished.current) setPlayback("paused"); };
    const buffering = () => setPlayback("buffering");
    const resume = () => { if (player.isPlaying()) playing(); };
    const ended = () => finish("ended");
    const time: CallbackListener<"timeupdate"> = ({ detail }) => {
      lastFrame.current = detail.frame;
      setFrame(detail.frame);
    };
    player.addEventListener("play", playing);
    player.addEventListener("pause", paused);
    player.addEventListener("waiting", buffering);
    player.addEventListener("resume", resume);
    player.addEventListener("ended", ended);
    player.addEventListener("error", fail);
    player.addEventListener("timeupdate", time);
    if (!started) player.seekTo(Math.max(initialFrame.current, openingFrame.current));
    if (!manualPreference || userStarted.current) {
      if (userStarted.current) player.unmute();
      player.play();
    }
    return () => {
      player.removeEventListener("play", playing);
      player.removeEventListener("pause", paused);
      player.removeEventListener("waiting", buffering);
      player.removeEventListener("resume", resume);
      player.removeEventListener("ended", ended);
      player.removeEventListener("error", fail);
      player.removeEventListener("timeupdate", time);
    };
  }, [player, inkReady, manualPreference, finish, fail]);

  useEffect(() => {
    setSlow(false);
    if (!waiting) return;
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [waiting]);

  const play = useCallback(() => {
    userStarted.current = true;
    region.current?.focus({ preventScroll: true });
    if (playback === "error" || (waiting && slow)) {
      initialFrame.current = lastFrame.current;
      setAttempt(value => value + 1);
      setPlayback("loading");
      return;
    }
    if (!inkReady) return;
    if (!started) player?.seekTo(Math.max(initialFrame.current, openingFrame.current));
    player?.unmute();
    player?.play();
  }, [player, inkReady, started, playback, waiting, slow]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.target !== region.current) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (player?.isPlaying()) player.pause(); else play();
      }
      if (event.key.toLowerCase() === "m" && player) {
        if (player.isMuted()) player.unmute(); else player.mute();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [finish, player, play]);

  return <div ref={region} className={cn("intro", portrait && "is-portrait", frame < OPENING_FRAMES && "is-opening", fading && `is-fading-${fading}`)}
    role="region" aria-label="MaxXP intro" tabIndex={-1} data-frame={frame} data-playback={playback}
    onClick={() => { if (needsPlay) play(); else { userStarted.current = true; player?.unmute(); } }}>
    <FilmBoundary key={attempt} onError={fail}>
      <Suspense fallback={null}>
        <ResponsiveFilm width={viewport.width} height={viewport.height} mobile={mobile}
          initialFrame={initialFrame.current} volume={volume} onReady={setPlayer} />
      </Suspense>
    </FilmBoundary>
    {!started && <LoadingMontage key={attempt} onError={fail} onReady={inkLoaded} onFrame={openingTick} still={manualPreference} width={viewport.width} height={viewport.height} />}
    {(needsPlay || (waiting && slow)) && <div className="intro-play-prompt">
      {playback === "error" ? <p>Playback was interrupted. Retry from here.</p> : waiting ? <p role="status">Still loading the film…</p> : null}
      <button type="button" className="xp-control" onClick={event => { event.stopPropagation(); play(); }}>
        {playback === "error" || waiting ? "Retry playback" : started ? "Resume intro" : "Play intro"}
      </button>
    </div>}
    <button type="button" className={cn("intro-skip", skipVisible && "is-visible")}
      onClick={event => { event.stopPropagation(); finish(); }}>Skip</button>
  </div>;
}
