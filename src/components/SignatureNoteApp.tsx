import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { portfolio } from "../data/portfolio";
import { drawSignature, loadInk, penAt, signature } from "../lib/calligraphy";

const quillAsset = "/quill-pen-transparent.png";
/** After the last stroke the fresh ink keeps drying for a moment. */
const DRY = 0.6;

/**
 * The quill follows the real handwriting, including pen lifts and the
 * flourish, using the same retimed recording as the intro film.
 */
export function AnimatedSignature({ runId }: { runId: number }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const quillRef = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState<HTMLImageElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let active = true;
    void loadInk().then((image) => {
      if (active) setInk(image);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!stage || !canvas || !ctx || !ink) return;
    let frame = 0;
    let begin = performance.now();
    const end = signature.duration + DRY;

    const paint = (t: number) => {
      const rect = stage.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(rect.width * ratio);
      const height = Math.round(rect.height * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.clearRect(0, 0, width, height);
      const scale = rect.width / signature.width;
      drawSignature(ctx, ink, t, { scale, dx: 0, dy: 0 }, ratio);
      const quill = quillRef.current;
      if (!quill) return;
      const pen = penAt(t);
      const tilt = -0.1 + Math.max(-0.08, Math.min(0.08, Math.sin(pen.heading) * 0.08));
      quill.style.transform = `translate3d(${pen.x * scale}px, ${pen.y * scale - pen.lift * rect.height * 0.08}px, 0) rotate(${tilt}rad)`;
      const fadeIn = Math.min(1, t / 0.12);
      const fadeOut = Math.min(1, Math.max(0, (signature.duration + 0.25 - t) / 0.25));
      quill.style.opacity = String(Math.min(fadeIn, fadeOut));
    };

    if (reduceMotion) {
      paint(end);
      return;
    }
    const tick = (now: number) => {
      // A frame's timestamp can precede the effect that scheduled it.
      const t = Math.max(0, (now - begin) / 1000);
      paint(Math.min(t, end));
      if (t < end) frame = requestAnimationFrame(tick);
    };
    begin = performance.now();
    frame = requestAnimationFrame(tick);
    // Keep the finished name crisp if the window is resized.
    const observer = new ResizeObserver(() => {
      if ((performance.now() - begin) / 1000 >= end) paint(end);
    });
    observer.observe(stage);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ink, reduceMotion, runId]);

  return (
    <div className="signature-stage" style={{ aspectRatio: `${signature.width} / ${signature.height}` }} ref={stageRef} role="img" aria-label={`Animated signature: ${portfolio.name}`}>
      <canvas className="signature-canvas" ref={canvasRef} />
      {!reduceMotion ? (
        <div className="signature-quill-anchor" ref={quillRef} style={{ opacity: 0 }}>
          <img src={quillAsset} alt="" draggable={false} />
        </div>
      ) : null}
    </div>
  );
}

export function SignatureNoteApp({ onContinue }: { onContinue: () => void }) {
  const [runId, setRunId] = useState(1);

  return (
    <section className="signature-note-app">
      <div className="signature-note-page">
        <div className="signature-note-heading">
          <span>Welcome to MaxXP</span>
          <small>{portfolio.location}</small>
        </div>
        <AnimatedSignature runId={runId} />
        <p className="signature-note-copy">
          Product engineer building Move systems, onchain markets, and agent infrastructure.
        </p>
      </div>
      <footer className="signature-note-actions">
        <span>Welcome to my desktop.</span>
        <div>
          <button className="xp-control" type="button" onClick={() => setRunId((value) => value + 1)}>
            Replay Signature
          </button>
          <button className="xp-control primary" type="button" onClick={onContinue}>
            Selected work
          </button>
        </div>
      </footer>
    </section>
  );
}
