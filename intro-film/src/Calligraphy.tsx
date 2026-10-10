/**
 * The quill writing "Maxwell Mohammadi", stroke by stroke, with the same pen
 * strokes and renderer as the site's quill window (src/lib/calligraphy):
 * each capital, each word in one flow, the x's crossing and the i's dot, the
 * flourish last. The quill rides the pen and lifts between strokes. Pure
 * function of `progress`.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender, Img, staticFile } from "remotion";
import { boundsOf, drawSignature, loadInk, penAt, signature } from "../../src/lib/calligraphy";

let inkCache: HTMLImageElement | null = null;
let loading: Promise<HTMLImageElement> | null = null;

function useInk() {
  const [ink, setInk] = useState<HTMLImageElement | null>(inkCache);
  const [handle] = useState(() => (inkCache ? null : delayRender("Loading the signature ink")));
  useEffect(() => {
    if (inkCache) return;
    loading ??= loadInk(staticFile("maxwell_mohammadi_signature_full_canvas.svg"));
    void loading.then((image) => {
      inkCache = image;
      setInk(image);
      if (handle !== null) continueRender(handle);
    });
  }, [handle]);
  return ink;
}

type Line = { x0: number; y0: number; x1: number; y1: number; left: number; top: number; scale: number; word?: number };

export function Calligraphy({ progress, width, twoLines = false, quill = 1 }: {
  /** 0..1 while writing; may run past 1 so the ink finishes drying. */
  progress: number;
  /** Display width of the signature block. */
  width: number;
  /** Portrait: "Maxwell" over "Mohammadi". */
  twoLines?: boolean;
  /** Quill size multiplier. */
  quill?: number;
}) {
  const ink = useInk();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = Math.max(0, progress) * signature.duration;

  // One line, or two stacked lines sharing a scale ("Mohammadi" set right).
  const lines: Line[] = (() => {
    if (!twoLines) {
      const b = boundsOf();
      return [{ ...b, left: 0, top: 0, scale: width / (b.x1 - b.x0) }];
    }
    const a = boundsOf(0);
    const b = boundsOf(1);
    const scale = width / Math.max(a.x1 - a.x0, b.x1 - b.x0);
    return [
      { ...a, left: 0, top: 0, scale, word: 0 },
      { ...b, left: width - (b.x1 - b.x0) * scale, top: (a.y1 - a.y0) * scale * 0.92, scale, word: 1 },
    ];
  })();
  const height = Math.max(...lines.map((l) => l.top + (l.y1 - l.y0) * l.scale));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !ink) return;
    const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const line of lines) {
      drawSignature(ctx, ink, t, { scale: line.scale, dx: line.left - line.x0 * line.scale, dy: line.top - line.y0 * line.scale, word: line.word }, ratio);
    }
  });

  // The quill rides the pen: on the paper while writing, lifted between
  // strokes, gone once the name is finished.
  let pen = null;
  if (t > 0 && t < signature.duration + 0.25) {
    const at = penAt(t);
    const line = lines.find((l) => l.word === undefined || l.word === at.word) ?? lines[0];
    pen = {
      x: line.left + (at.x - line.x0) * line.scale,
      y: line.top + (at.y - line.y0) * line.scale - at.lift * 14,
      tilt: -6 + Math.max(-4, Math.min(4, Math.sin(at.heading) * 4)),
      lift: at.lift,
    };
  }
  const fadeIn = Math.min(1, t / 0.12);
  const fadeOut = Math.min(1, Math.max(0, (signature.duration + 0.25 - t) / 0.25));
  const box = boundsOf();
  const quillW = (box.y1 - box.y0) * lines[0].scale * 1.25 * quill;

  return (
    <div style={{ position: "relative", width, height }}>
      <canvas ref={canvasRef} style={{ position: "absolute", left: 0, top: 0, width, height }} />
      {pen ? (
        <div style={{ position: "absolute", left: pen.x, top: pen.y, opacity: Math.min(fadeIn, fadeOut), transform: `rotate(${pen.tilt}deg)`, transformOrigin: "0 0" }}>
          <Img
            src={staticFile("quill-pen-transparent.png")}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: quillW,
              transform: "translate(-0.6475%, -99.0955%)",
              filter: `drop-shadow(${4 + pen.lift * 6}px ${6 + pen.lift * 8}px ${4 + pen.lift * 4}px rgb(30 34 20 / ${0.3 - pen.lift * 0.08}))`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
