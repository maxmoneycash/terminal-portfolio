import { useEffect, useRef, useState } from "react";
import { loadInk } from "../lib/calligraphy";
import { BanknoteOpening, OPENING_FRAMES } from "./BanknoteOpening";

/** Runs immediately, even while the MP4 is still downloading. */
export function LoadingMontage({ startedAt, still, portrait }: { startedAt: number; still: boolean; portrait: boolean }) {
  const [frame, setFrame] = useState(0);
  const [ink, setInk] = useState<HTMLImageElement | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const width = portrait ? 540 : 1280;
  const height = portrait ? 960 : 720;
  useEffect(() => {
    let active = true;
    void loadInk().then(image => { if (active) setInk(image); }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (still) return;
    let request = 0;
    const tick = () => {
      const next = Math.min(OPENING_FRAMES - 1, Math.floor((performance.now() - startedAt) * .03));
      setFrame(next);
      if (next < OPENING_FRAMES - 1) request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [startedAt, still]);
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
    <div className="intro-loading-art">
      <div ref={stage} style={{ position: "absolute", left: "50%", top: "50%", width, height, transformOrigin: "center", transform: "translate(-50%, -50%)" }}>
        <BanknoteOpening frame={still ? OPENING_FRAMES - 1 : frame} width={width} height={height} ink={ink} />
      </div>
    </div>
  );
}
