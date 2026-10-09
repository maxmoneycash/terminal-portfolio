import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { portfolio } from "../data/portfolio";
import { inkPoint, loadInkMap, signatureSize, type InkMap } from "../lib/signatureInk";

const signatureAsset = "/maxwell_mohammadi_signature_full_canvas.svg";
const quillAsset = "/quill-pen-transparent.png";

export function AnimatedSignature({ runId }: { runId: number }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [inkMap, setInkMap] = useState<InkMap | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const reduceMotion = useReducedMotion();
  const progress = useMotionValue(0);

  useEffect(() => {
    let active = true;
    void loadInkMap(signatureAsset)
      .then((map) => {
        if (active) setInkMap(map);
      })
      .catch(() => {
        if (active) progress.set(1);
      });
    return () => {
      active = false;
    };
  }, [progress]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      const rect = stage.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inkMap) return;
    progress.set(reduceMotion ? 1 : 0);
    if (reduceMotion) return;
    const playback = animate(progress, 1, {
      duration: 2.7,
      ease: [0.45, 0, 0.55, 1],
    });
    return () => playback.stop();
  }, [inkMap, progress, reduceMotion, runId]);

  const signatureClip = useTransform(progress, (value) => {
    if (!inkMap || value >= 0.999) return "inset(0 0% 0 0)";
    const revealX = inkMap.minX + (inkMap.maxX - inkMap.minX) * value;
    return `inset(0 ${100 - (revealX / signatureSize.width) * 100}% 0 0)`;
  });

  const penTransform = useTransform(progress, (value) => {
    if (!inkMap || stageSize.width === 0) return "translate3d(0, 0, 0) rotate(0rad)";
    const point = inkPoint(inkMap, value);
    const previous = inkPoint(inkMap, Math.max(0, value - 0.012));
    const next = inkPoint(inkMap, Math.min(1, value + 0.012));
    const x = (point.x / signatureSize.width) * stageSize.width;
    const y = (point.y / signatureSize.height) * stageSize.height;
    const angle = Math.max(-0.45, Math.min(0.45, Math.atan2(next.y - previous.y, next.x - previous.x)));
    return `translate3d(${x}px, ${y}px, 0) rotate(${angle}rad)`;
  });

  const penOpacity = useTransform(progress, [0, 0.015, 0.95, 1], [0, 1, 1, 0]);

  return (
    <div className="signature-stage" ref={stageRef} role="img" aria-label={`Animated signature: ${portfolio.name}`}>
      <motion.img
        className="signature-ink"
        src={signatureAsset}
        alt=""
        draggable={false}
        style={{ clipPath: signatureClip }}
      />
      {!reduceMotion ? (
        <motion.div className="signature-quill-anchor" style={{ opacity: penOpacity, transform: penTransform }}>
          <img src={quillAsset} alt="" draggable={false} />
        </motion.div>
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
