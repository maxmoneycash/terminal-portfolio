import { useEffect, useMemo, useState } from "react";
import { portfolio, type PortfolioVideo } from "../data/portfolio";
import { cn } from "../lib/cn";

type VideoShowcaseOverlayProps = {
  visible: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

function sourceLabel(video: PortfolioVideo) {
  const primary = video.sources.find((source) => source.type === "video/mp4") ?? video.sources[0];
  return primary ? primary.quality : "video";
}

export function VideoShowcaseOverlay({ visible, selectedId, onSelect, onClose }: VideoShowcaseOverlayProps) {
  const selectedVideo = useMemo(() => {
    return portfolio.videos.find((video) => video.id === selectedId) ?? portfolio.videos[0];
  }, [selectedId]);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPosterFailed(false);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, selectedId, visible]);

  useEffect(() => {
    setPosterFailed(false);
  }, [selectedId]);

  if (!visible) return null;

  return (
    <section
      className="video-showcase-orbit"
      aria-label="Portfolio video demos"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="video-showcase-shell">
        <header className="video-showcase-header">
          <div>
            <p className="video-showcase-kicker">video proof</p>
            <h2>Portfolio demos</h2>
          </div>
          <button className="video-showcase-close" type="button" onClick={onClose} aria-label="Close video showcase">
            close
          </button>
        </header>

        <div className="video-showcase-layout">
          <nav className="video-showcase-list" aria-label="Video demos">
            {portfolio.videos.map((video, index) => {
              const active = video.id === selectedVideo.id;
              return (
                <button
                  key={video.id}
                  className={cn("video-showcase-item", active && "is-active")}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => onSelect(video.id)}
                >
                  <span className="video-showcase-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="video-showcase-copy">
                    <span>{video.title}</span>
                    <small>{video.date}</small>
                  </span>
                  <span className="video-showcase-quality">{sourceLabel(video)}</span>
                </button>
              );
            })}
          </nav>

          <figure className="video-showcase-player">
            <div className="video-showcase-frame">
              <video
                key={selectedVideo.id}
                controls
                playsInline
                preload="metadata"
                poster={posterFailed ? undefined : selectedVideo.poster}
                onError={() => setPosterFailed(true)}
              >
                {selectedVideo.sources.map((source) => (
                  <source key={source.src} src={source.src} type={source.type} />
                ))}
              </video>
            </div>
            <figcaption className="video-showcase-caption">
              <span>{selectedVideo.title}</span>
              <small>{selectedVideo.summary}</small>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
