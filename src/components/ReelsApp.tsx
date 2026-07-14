import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, LayoutGroup, animate, motion, useReducedMotion, type AnimationPlaybackControls } from "framer-motion";
import { portfolio, type PortfolioVideo } from "../data/portfolio";
import { cn } from "../lib/cn";
import { easeOut, motionTransition, press, stagger, staggerItem } from "../lib/motion";
import { Tooltip } from "./Tooltip";

const featuredVideoId = "best-1";

function orderSources(video: PortfolioVideo, preferHls: boolean) {
  return [...video.sources].sort((a, b) => {
    const aIsHls = a.type.includes("mpegurl");
    const bIsHls = b.type.includes("mpegurl");

    if (aIsHls === bIsHls) {
      return 0;
    }

    return preferHls ? (aIsHls ? -1 : 1) : aIsHls ? 1 : -1;
  });
}

export function ReelsApp({ active = true }: { active?: boolean }) {
  const videos = useMemo(() => {
    const featured = portfolio.videos.find((video) => video.id === featuredVideoId);
    const rest = portfolio.videos.filter((video) => video.id !== featuredVideoId);
    return featured ? [featured, ...rest] : portfolio.videos;
  }, []);
  const [preferHls, setPreferHls] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const scrollAnimationRef = useRef<AnimationPlaybackControls | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isTouchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    const isAppleMobile = /iPad|iPhone|iPod/.test(userAgent) || isTouchMac;
    const isSafari = /Safari/i.test(userAgent) && !/Chrome|CriOS|FxiOS|Edg|OPR/i.test(userAgent);

    setPreferHls(isAppleMobile || isSafari);
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    setSaveData(Boolean(connection?.saveData));
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

  useEffect(() => {
    videoRefs.current.forEach((element, index) => {
      if (!element) return;
      element.muted = muted;
      if (active && !saveData && index === activeIndex) {
        void element.play().catch(() => {});
      } else {
        element.pause();
      }
    });
  }, [active, activeIndex, muted, saveData]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const stopProgrammaticScroll = () => scrollAnimationRef.current?.stop();
    feed.addEventListener("wheel", stopProgrammaticScroll, { passive: true });
    feed.addEventListener("touchstart", stopProgrammaticScroll, { passive: true });
    feed.addEventListener("pointerdown", stopProgrammaticScroll, { passive: true });
    return () => {
      scrollAnimationRef.current?.stop();
      feed.removeEventListener("wheel", stopProgrammaticScroll);
      feed.removeEventListener("touchstart", stopProgrammaticScroll);
      feed.removeEventListener("pointerdown", stopProgrammaticScroll);
    };
  }, []);

  const scrollToIndex = (index: number) => {
    if (index < 0 || index >= videos.length) return;
    const feed = feedRef.current;
    const target = feed?.querySelector<HTMLElement>(`[data-reel-index="${index}"]`);
    if (!feed || !target) return;
    scrollAnimationRef.current?.stop();
    if (reduceMotion) {
      feed.scrollTop = target.offsetTop;
      return;
    }
    scrollAnimationRef.current = animate(feed.scrollTop, target.offsetTop, {
      duration: 0.28,
      ease: easeOut,
      onUpdate: (value) => { feed.scrollTop = value; },
    });
  };

  const togglePlayback = (index: number) => {
    const element = videoRefs.current[index];
    if (!element) return;
    if (element.paused) {
      void element.play().catch(() => {});
    } else {
      element.pause();
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      scrollToIndex(activeIndex + 1);
    } else if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      scrollToIndex(activeIndex - 1);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      togglePlayback(activeIndex);
    } else if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      setMuted((value) => !value);
    }
  };

  return (
    <div className="reels-app">
      <div
        className="reels-feed"
        ref={feedRef}
        tabIndex={0}
        aria-label="Demo reels feed. Use arrow keys to change clips, space to pause, and M to mute."
        onKeyDown={handleKeyDown}
      >
        {videos.map((video, index) => (
          <motion.section
            className={cn("reel-slide", activeIndex === index && "is-active")}
            data-reel-index={index}
            key={video.id}
            aria-label={video.title}
          >
            <video
              key={`${video.id}-${preferHls ? "hls" : "mp4"}`}
              ref={(element) => {
                videoRefs.current[index] = element;
              }}
              playsInline
              muted={muted}
              loop
              preload={index === 0 && !saveData ? "metadata" : "none"}
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
            <AnimatePresence>
              {activeIndex === index ? (
                <motion.div
                  className="reel-caption"
                  initial={{ opacity: 0, transform: "translate3d(0, 10px, 0) scale(0.99)" }}
                  animate={{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }}
                  exit={{ opacity: 0, transform: "translate3d(0, 5px, 0) scale(0.995)" }}
                  transition={motionTransition.panel}
                >
                  <p className="reel-kicker">
                    {String(index + 1).padStart(2, "0")} / {String(videos.length).padStart(2, "0")} · {video.date}
                  </p>
                  <strong>{video.title}</strong>
                  <p>{video.summary}</p>
                  {saveData ? <small>Data Saver is on · tap the video to play</small> : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>
        ))}
      </div>
      <motion.div className="reels-rail" variants={stagger} initial="hidden" animate="visible">
        <Tooltip label="Previous clip">
          <motion.button
            className="reel-nav"
            type="button"
            aria-label="Previous clip"
            disabled={activeIndex === 0}
            onClick={() => scrollToIndex(activeIndex - 1)}
            variants={staggerItem}
            whileTap={press}
            transition={motionTransition.micro}
          >
            ▲
          </motion.button>
        </Tooltip>
        <span className="reels-count">
          {activeIndex + 1}/{videos.length}
        </span>
        <LayoutGroup id="reels-progress">
        <div className="reels-progress" aria-label="Choose a demo clip">
          {videos.map((video, index) => (
            <motion.button
              key={video.id}
              type="button"
              className={cn(index === activeIndex && "is-active")}
              aria-label={`Open clip ${index + 1}: ${video.title}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => scrollToIndex(index)}
              whileTap={press}
              transition={motionTransition.micro}
            >
              {index === activeIndex ? (
                <motion.span className="reel-progress-active" layoutId="reel-progress-active" transition={motionTransition.spatial} />
              ) : null}
            </motion.button>
          ))}
        </div>
        </LayoutGroup>
        <Tooltip label="Next clip">
          <motion.button
            className="reel-nav"
            type="button"
            aria-label="Next clip"
            disabled={activeIndex === videos.length - 1}
            onClick={() => scrollToIndex(activeIndex + 1)}
            variants={staggerItem}
            whileTap={press}
            transition={motionTransition.micro}
          >
            ▼
          </motion.button>
        </Tooltip>
        <Tooltip label={playing ? "Pause clip" : "Play clip"}>
          <motion.button
            className="reel-nav reel-playback"
            type="button"
            aria-label={playing ? "Pause clip" : "Play clip"}
            onClick={() => togglePlayback(activeIndex)}
            variants={staggerItem}
            whileTap={press}
            transition={motionTransition.micro}
          >
            {playing ? "Ⅱ" : "▶"}
          </motion.button>
        </Tooltip>
        <Tooltip label={muted ? "Turn sound on" : "Mute"}>
          <motion.button
            className="reel-nav reel-sound"
            type="button"
            aria-label={muted ? "Turn sound on" : "Mute"}
            onClick={() => setMuted((value) => !value)}
            variants={staggerItem}
            whileTap={press}
            transition={motionTransition.micro}
          >
            {muted ? "MUTED" : "SOUND"}
          </motion.button>
        </Tooltip>
      </motion.div>
    </div>
  );
}
