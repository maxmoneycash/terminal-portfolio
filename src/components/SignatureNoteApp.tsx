import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { portfolio } from "../data/portfolio";

const signatureAsset = "/maxwell_mohammadi_signature_full_canvas.svg";
const quillAsset = "/quill-pen-transparent.png";
const signatureSize = { width: 2048, height: 512 };

type InkMap = {
  minX: number;
  maxX: number;
  centerYByX: Float32Array;
  previousInkByX: Int32Array;
  nextInkByX: Int32Array;
};

let inkMapPromise: Promise<InkMap> | null = null;

function loadInkMap() {
  if (inkMapPromise) return inkMapPromise;

  inkMapPromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = signatureSize.width;
      canvas.height = signatureSize.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        reject(new Error("Unable to sample signature ink."));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const hasInk = new Uint8Array(canvas.width);
      const centerYByX = new Float32Array(canvas.width);
      centerYByX.fill(Number.NaN);
      let minX = canvas.width;
      let maxX = 0;

      for (let x = 0; x < canvas.width; x += 1) {
        let weightedY = 0;
        let alphaWeight = 0;
        for (let y = 0; y < canvas.height; y += 1) {
          const alpha = pixels[(y * canvas.width + x) * 4 + 3] ?? 0;
          if (alpha <= 24) continue;
          weightedY += y * alpha;
          alphaWeight += alpha;
        }
        if (alphaWeight === 0) continue;
        hasInk[x] = 1;
        centerYByX[x] = weightedY / alphaWeight;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }

      if (minX >= canvas.width) {
        reject(new Error("Signature image has no visible ink."));
        return;
      }

      const previousInkByX = new Int32Array(canvas.width);
      const nextInkByX = new Int32Array(canvas.width);
      previousInkByX.fill(-1);
      nextInkByX.fill(-1);
      let previous = -1;
      for (let x = 0; x < canvas.width; x += 1) {
        if (hasInk[x]) previous = x;
        previousInkByX[x] = previous;
      }
      let next = -1;
      for (let x = canvas.width - 1; x >= 0; x -= 1) {
        if (hasInk[x]) next = x;
        nextInkByX[x] = next;
      }

      resolve({ minX, maxX, centerYByX, previousInkByX, nextInkByX });
    };
    image.onerror = () => reject(new Error("Unable to load signature image."));
    image.src = signatureAsset;
  });

  return inkMapPromise;
}

function inkPoint(map: InkMap, progress: number) {
  const target = map.minX + (map.maxX - map.minX) * Math.max(0, Math.min(1, progress));
  const rounded = Math.round(target);
  const exactY = map.centerYByX[rounded];
  if (Number.isFinite(exactY)) return { x: target, y: exactY };

  const previous = map.previousInkByX[rounded] ?? -1;
  const next = map.nextInkByX[rounded] ?? -1;
  if (previous >= 0 && next >= 0 && next !== previous) {
    const gapProgress = (target - previous) / (next - previous);
    const previousY = map.centerYByX[previous] || signatureSize.height / 2;
    const nextY = map.centerYByX[next] || previousY;
    const lift = Math.min(34, Math.max(7, (next - previous) * 0.07)) * Math.sin(gapProgress * Math.PI);
    return { x: target, y: previousY + (nextY - previousY) * gapProgress - lift };
  }

  const fallback = previous >= 0 ? previous : next >= 0 ? next : map.minX;
  return { x: fallback, y: map.centerYByX[fallback] || signatureSize.height / 2 };
}

function AnimatedSignature({ runId }: { runId: number }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [inkMap, setInkMap] = useState<InkMap | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const reduceMotion = useReducedMotion();
  const progress = useMotionValue(0);

  useEffect(() => {
    let active = true;
    void loadInkMap()
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
        <span>Signed by hand · replay anytime from the Start menu</span>
        <div>
          <button className="xp-control" type="button" onClick={() => setRunId((value) => value + 1)}>
            Replay Signature
          </button>
          <button className="xp-control primary" type="button" onClick={onContinue}>
            About Max
          </button>
        </div>
      </footer>
    </section>
  );
}
