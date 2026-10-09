/**
 * The quill writing "Maxwell Mohammadi", driven by a progress value so every
 * frame renders the same: the same ink map and pen path as the site's
 * signature window (src/lib/signatureInk.ts).
 */
import { useEffect, useState } from "react";
import { continueRender, delayRender, Img, staticFile } from "remotion";
import { inkPoint, loadInkMap, signatureSize, type InkMap } from "../../src/lib/signatureInk";

const SIGNATURE = staticFile("maxwell_mohammadi_signature_full_canvas.svg");
const QUILL = staticFile("quill-pen-transparent.png");
let ready: InkMap | null = null;

function useInkMap() {
  const [map, setMap] = useState<InkMap | null>(ready);
  const [handle] = useState(() => (ready ? null : delayRender("Sampling the signature ink")));
  useEffect(() => {
    if (ready) return;
    void loadInkMap(SIGNATURE).then((loaded) => {
      ready = loaded;
      setMap(loaded);
      if (handle !== null) continueRender(handle);
    });
  }, [handle]);
  return map;
}

export function FilmSignature({ progress, width, quill = 92 }: { progress: number; width: number; quill?: number }) {
  const map = useInkMap();
  const height = width / 4;
  if (!map) return null;
  const p = Math.max(0, Math.min(1, progress));
  const revealX = map.minX + (map.maxX - map.minX) * p;
  const clip = p >= 0.999 ? "inset(0 0 0 0)" : `inset(0 ${100 - (revealX / signatureSize.width) * 100}% 0 0)`;
  const point = inkPoint(map, p);
  const before = inkPoint(map, Math.max(0, p - 0.012));
  const after = inkPoint(map, Math.min(1, p + 0.012));
  const angle = Math.max(-0.45, Math.min(0.45, Math.atan2(after.y - before.y, after.x - before.x)));
  const penOpacity = p <= 0 ? 0 : p < 0.015 ? p / 0.015 : p > 0.95 ? Math.max(0, (1 - p) / 0.05) : 1;
  return (
    <div style={{ position: "relative", width, height }}>
      <Img
        src={SIGNATURE}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          clipPath: clip,
          filter: "invert(20%) sepia(86%) saturate(1743%) hue-rotate(200deg) brightness(73%) contrast(98%)",
          opacity: 0.92,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          opacity: penOpacity,
          transform: `translate(${(point.x / signatureSize.width) * width}px, ${(point.y / signatureSize.height) * height}px) rotate(${angle}rad)`,
          transformOrigin: "0 0",
        }}
      >
        <Img src={QUILL} style={{ position: "absolute", left: 0, top: 0, width: quill, transform: "translate(-0.6475%, -99.0955%)", filter: "drop-shadow(0 4px 4px rgb(38 44 22 / 0.28))" }} />
      </div>
    </div>
  );
}
