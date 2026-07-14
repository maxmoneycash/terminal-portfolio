import { useEffect, useMemo, useRef, useState } from "react";
import { portfolio, type PortfolioVideo } from "../data/portfolio";
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

export function ReelsApp() {
  const videos = useMemo(() => {
    const featured = portfolio.videos.find((video) => video.id === featuredVideoId);
    const rest = portfolio.videos.filter((video) => video.id !== featuredVideoId);
    return featured ? [featured, ...rest] : portfolio.videos;
  }, []);
  const [preferHls, setPreferHls] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

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
      if (index === activeIndex) {
        void element.play().catch(() => {});
      } else {
        element.pause();
      }
    });
  }, [activeIndex, muted]);

  const scrollToIndex = (index: number) => {
    if (index < 0 || index >= videos.length) return;
    feedRef.current
      ?.querySelector(`[data-reel-index="${index}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  return (
    <div className="reels-app">
      <div className="reels-feed" ref={feedRef} tabIndex={0} aria-label="Demo reels feed">
        {videos.map((video, index) => (
          <section className="reel-slide" data-reel-index={index} key={video.id} aria-label={video.title}>
            <video
              key={`${video.id}-${preferHls ? "hls" : "mp4"}`}
              ref={(element) => {
                videoRefs.current[index] = element;
              }}
              playsInline
              muted
              loop
              preload={index === 0 ? "auto" : "none"}
              poster={video.poster}
              onClick={() => togglePlayback(index)}
            >
              {orderSources(video, preferHls).map((source) => (
                <source key={source.src} src={source.src} type={source.type} />
              ))}
            </video>
            <div className="reel-caption">
              <p className="reel-kicker">
                {String(index + 1).padStart(2, "0")} / {String(videos.length).padStart(2, "0")} • {video.date}
              </p>
              <strong>{video.title}</strong>
              <p>{video.summary}</p>
            </div>
          </section>
        ))}
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
        <Tooltip label="Next clip">
          <button
            className="reel-nav"
            type="button"
            aria-label="Next clip"
            disabled={activeIndex === videos.length - 1}
            onClick={() => scrollToIndex(activeIndex + 1)}
          >
            ▼
          </button>
        </Tooltip>
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
      </div>
    </div>
  );
}
