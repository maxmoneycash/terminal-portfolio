import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { portfolio, type PortfolioVideo } from "../data/portfolio";
import { cn } from "../lib/cn";
import { Tooltip } from "./Tooltip";

const featuredVideoId = "aptos-vs-megaeth";

/** Slides this far from the active one keep a live <video>; the rest show a poster. */
const MOUNT_RADIUS = 1;

function orderSources(video: PortfolioVideo, preferHls: boolean) {
  return [...video.sources].sort((a, b) => {
    const aIsHls = a.type.includes("mpegurl");
    const bIsHls = b.type.includes("mpegurl");
    if (aIsHls === bIsHls) return 0;
    return preferHls ? (aIsHls ? -1 : 1) : aIsHls ? 1 : -1;
  });
}

function linkLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDuration(seconds?: number) {
  if (!seconds) return null;
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export function ReelsApp({ active = true }: { active?: boolean }) {
  const videos = useMemo<PortfolioVideo[]>(() => {
    const featured = portfolio.videos.find((video) => video.id === featuredVideoId);
    const rest = portfolio.videos.filter((video) => video.id !== featuredVideoId);
    return featured ? [featured, ...rest] : portfolio.videos;
  }, []);
  const [preferHls, setPreferHls] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const lastIndex = videos.length - 1;

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isTouchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    const isAppleMobile = /iPad|iPhone|iPod/.test(userAgent) || isTouchMac;
    const isSafari = /Safari/i.test(userAgent) && !/Chrome|CriOS|FxiOS|Edg|OPR/i.test(userAgent);
    setPreferHls(isAppleMobile || isSafari);
  }, []);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const slides = Array.from(feed.querySelectorAll<HTMLElement>("[data-reel-index]"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          setPlaying(false);
          setActiveIndex(Number((entry.target as HTMLElement).dataset.reelIndex));
        });
      },
      { root: feed, threshold: 0.6 },
    );
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, []);

  // Only the active clip plays; neighbours stay mounted (buffered) but paused.
  useEffect(() => {
    videoRefs.current.forEach((element, index) => {
      if (!element) return;
      element.muted = muted;
      if (active && index === activeIndex) {
        void element.play().catch(() => {});
      } else {
        element.pause();
      }
    });
  }, [active, activeIndex, muted]);

  const scrollToIndex = (index: number, behavior?: ScrollBehavior) => {
    const target = Math.max(0, Math.min(lastIndex, index));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    feedRef.current
      ?.querySelector(`[data-reel-index="${target}"]`)
      ?.scrollIntoView({ behavior: behavior ?? (reduceMotion ? "auto" : "smooth"), block: "start" });
  };

  const togglePlayback = (index: number) => {
    const element = videoRefs.current[index];
    if (!element) return;
    if (element.paused) void element.play().catch(() => {});
    else element.pause();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      scrollToIndex(activeIndex + 1);
    } else if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      scrollToIndex(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      scrollToIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      scrollToIndex(lastIndex);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      togglePlayback(activeIndex);
    } else if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      setMuted((value) => !value);
    }
  };

  /* Scrubber: a single vertical track instead of one button per clip, so it
     stays usable whether the feed holds six clips or sixty. */
  const indexFromPointer = (clientY: number) => {
    const rect = scrubberRef.current?.getBoundingClientRect();
    if (!rect || rect.height <= 0) return activeIndex;
    const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return Math.round(ratio * lastIndex);
  };

  const handleScrubStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    scrollToIndex(indexFromPointer(event.clientY), "auto");
  };

  const handleScrubMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const next = indexFromPointer(event.clientY);
    if (next !== activeIndex) scrollToIndex(next, "auto");
  };

  const handleScrubKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };
    if (event.key in step) {
      event.preventDefault();
      scrollToIndex(activeIndex + step[event.key]);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      scrollToIndex(event.key === "Home" ? 0 : lastIndex);
    }
  };

  const progress = lastIndex > 0 ? activeIndex / lastIndex : 0;
  const current = videos[activeIndex];

  return (
    <div className="reels-app">
      <div
        className="reels-feed"
        ref={feedRef}
        tabIndex={0}
        aria-label="Demo reels feed. Use arrow keys to change clips, space to pause, and M to mute."
        onKeyDown={handleKeyDown}
      >
        {videos.map((video, index) => {
          const mounted = Math.abs(index - activeIndex) <= MOUNT_RADIUS;
          const duration = formatDuration(video.durationSeconds);
          const shape = { "--reel-w": video.width, "--reel-h": video.height } as CSSProperties;
          return (
            <section
              className={cn("reel-slide", activeIndex === index && "is-active")}
              data-reel-index={index}
              key={video.id}
              aria-label={video.title}
            >
              <div className="reel-stage">
                {mounted ? (
                  <video
                    key={`${video.id}-${preferHls ? "hls" : "mp4"}`}
                    ref={(element) => {
                      videoRefs.current[index] = element;
                    }}
                    className="reel-media"
                    style={shape}
                    playsInline
                    muted={muted}
                    loop
                    preload={index === activeIndex ? "auto" : "metadata"}
                    poster={video.poster}
                    onClick={() => togglePlayback(index)}
                    onPlay={() => {
                      if (index === activeIndex) setPlaying(true);
                    }}
                    onPause={() => {
                      if (index === activeIndex) setPlaying(false);
                    }}
                  >
                    {orderSources(video, preferHls).map((source) => (
                      <source key={source.src} src={source.src} type={source.type} />
                    ))}
                  </video>
                ) : (
                  <img className="reel-media" style={shape} src={video.poster} alt="" loading="lazy" decoding="async" />
                )}
              </div>
              <div className="reel-caption">
                <p className="reel-kicker">
                  {String(index + 1).padStart(2, "0")} / {String(videos.length).padStart(2, "0")} • {video.date}
                  {duration ? ` • ${duration}` : null}
                </p>
                <strong>{video.title}</strong>
                <p>{video.summary}</p>
                {video.link ? (
                  <a className="reel-link" href={video.link} target="_blank" rel="noreferrer">
                    {linkLabel(video.link)} ↗
                  </a>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <div className="reels-rail">
        <Tooltip label="Previous clip">
          <button
            className="reel-nav"
            type="button"
            aria-label="Previous clip"
            disabled={activeIndex === 0}
            onClick={() => scrollToIndex(activeIndex - 1)}
          >
            ▲
          </button>
        </Tooltip>
        <span className="reels-count">
          {activeIndex + 1}/{videos.length}
        </span>
        <div
          ref={scrubberRef}
          className="reels-scrubber"
          role="slider"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Choose a demo clip"
          aria-valuemin={1}
          aria-valuemax={videos.length}
          aria-valuenow={activeIndex + 1}
          aria-valuetext={`Clip ${activeIndex + 1} of ${videos.length}: ${current?.title ?? ""}`}
          style={{ "--reel-progress": progress } as CSSProperties}
          onPointerDown={handleScrubStart}
          onPointerMove={handleScrubMove}
          onKeyDown={handleScrubKey}
        >
          <span className="reels-scrubber-fill" />
          <span className="reels-scrubber-thumb" />
        </div>
        <Tooltip label="Next clip">
          <button
            className="reel-nav"
            type="button"
            aria-label="Next clip"
            disabled={activeIndex === lastIndex}
            onClick={() => scrollToIndex(activeIndex + 1)}
          >
            ▼
          </button>
        </Tooltip>
        <Tooltip label={playing ? "Pause clip" : "Play clip"}>
          <button
            className="reel-nav reel-playback"
            type="button"
            aria-label={playing ? "Pause clip" : "Play clip"}
            onClick={() => togglePlayback(activeIndex)}
          >
            {playing ? "Ⅱ" : "▶"}
          </button>
        </Tooltip>
        {current?.hasAudio ? (
        <Tooltip label={muted ? "Turn sound on" : "Mute"}>
          <button
            className="reel-nav reel-sound"
            type="button"
            aria-label={muted ? "Turn sound on" : "Mute"}
            onClick={() => setMuted((value) => !value)}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
