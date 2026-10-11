import { useEffect, useRef, useState } from "react";
import { loadInk } from "../lib/calligraphy";
import { BanknoteOpening, OPENING_FRAMES } from "./BanknoteOpening";
import openingMedia from "./openingMedia.json";
import { filmDimensions } from "./filmDimensions";

/** The writing clock starts only after the ink has decoded. The player joins it. */
export function LoadingMontage({ still, onReady, onError, onFrame, width: viewportWidth, height: viewportHeight }: { still: boolean; onReady: () => void; onError: () => void; onFrame: (frame: number) => void; width: number; height: number }) {
  const [frame, setFrame] = useState(0);
  const [ink, setInk] = useState<HTMLImageElement | null>(null);
  const startedAt = useRef<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const motion = useRef<HTMLVideoElement>(null);
  const { width, height } = filmDimensions(viewportWidth, viewportHeight);
  useEffect(() => {
    let active = true;
    void loadInk().then(image => { if (active) { setInk(image); onReady(); } }).catch(() => { if (active) onError(); });
    return () => { active = false; };
  }, [onReady, onError]);
  useEffect(() => {
    if (!ink) return;
    startedAt.current ??= performance.now();
    let request = 0;
    const tick = () => {
      const next = Math.min(OPENING_FRAMES - 1, Math.floor((performance.now() - startedAt.current!) * .03));
      setFrame(next);
      onFrame(next);
      if (next < OPENING_FRAMES - 1) request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [ink, onFrame]);
  useEffect(() => {
    const element = stage.current;
    if (!element?.parentElement) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      element.style.transform = `translate(-50%, -50%) scale(${Math.min(w / width, h / height)})`;
    });
    observer.observe(element.parentElement);
    return () => observer.disconnect();
  }, [width, height]);
  return (
    <div className="intro-loading-art" data-opening-frame={frame}>
      <div ref={stage} style={{ position: "absolute", left: "50%", top: "50%", width, height, transformOrigin: "center", transform: "translate(-50%, -50%)" }}>
        <BanknoteOpening frame={frame} width={width} height={height} ink={ink}
          motion={!still && <video ref={motion} src={`/${openingMedia.src}`} autoPlay muted playsInline preload="auto"
            onLoadedMetadata={() => {
              const video = motion.current;
              if (!video) return;
              const rate = openingMedia.duration / (openingMedia.frames / 30);
              video.playbackRate = rate;
              video.currentTime = Math.min(openingMedia.duration - .05, frame / 30 * rate);
              void video.play().catch(() => {});
            }}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />} />
      </div>
    </div>
  );
}
