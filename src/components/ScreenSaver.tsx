/**
 * Screensaver subsystem: a Mystify-style polyline renderer (the XP classic),
 * a persisted settings store shared with Display Properties, and the idle
 * overlay the shell mounts. Any input wakes it; users with reduced motion
 * never get it automatically.
 */
import { useEffect, useRef, useState } from "react";

export type SaverKind = "none" | "mystify";

export type SaverSettings = {
  saver: SaverKind;
  waitMinutes: number;
};

const SETTINGS_KEY = "maxxp:screensaver";
const DEFAULT_SETTINGS: SaverSettings = { saver: "mystify", waitMinutes: 5 };
const PREVIEW_EVENT = "maxxp:screensaver-preview";

let settings = readSettings();
const listeners = new Set<(value: SaverSettings) => void>();

function readSettings(): SaverSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SaverSettings>;
    return {
      saver: parsed.saver === "none" ? "none" : "mystify",
      waitMinutes: Math.max(1, Math.min(60, Number(parsed.waitMinutes) || DEFAULT_SETTINGS.waitMinutes)),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function getSaverSettings() {
  return settings;
}

export function setSaverSettings(next: Partial<SaverSettings>) {
  settings = { ...settings, ...next };
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage optional.
  }
  listeners.forEach((listener) => listener(settings));
}

export function subscribeSaver(listener: (value: SaverSettings) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Display Properties' "Preview" button starts the saver immediately. */
export function previewScreenSaver() {
  window.dispatchEvent(new CustomEvent(PREVIEW_EVENT));
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ------------------------------------------------------------------ */
/* Mystify renderer                                                    */
/* ------------------------------------------------------------------ */

type Vertex = { x: number; y: number; vx: number; vy: number };

type Shape = {
  vertices: Vertex[];
  trail: { x: number; y: number }[][];
  hue: number;
  hueSpeed: number;
};

function makeShape(width: number, height: number, speed: number, hue: number): Shape {
  const vertices = Array.from({ length: 4 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() * 0.6 + 0.7) * speed * (Math.random() < 0.5 ? -1 : 1),
    vy: (Math.random() * 0.6 + 0.7) * speed * (Math.random() < 0.5 ? -1 : 1),
  }));
  return { vertices, trail: [], hue, hueSpeed: 0.4 + Math.random() * 0.5 };
}

export function MystifyCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 0;
    let height = 0;
    let shapes: Shape[] = [];
    let frame = 0;
    let raf = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const speed = Math.max(1.1, width / 640);
      shapes = [makeShape(width, height, speed, 120), makeShape(width, height, speed, 300)];
    };

    const step = () => {
      frame += 1;
      context.fillStyle = "#000";
      context.fillRect(0, 0, width, height);

      for (const shape of shapes) {
        for (const vertex of shape.vertices) {
          vertex.x += vertex.vx;
          vertex.y += vertex.vy;
          if (vertex.x <= 0 || vertex.x >= width) vertex.vx *= -1;
          if (vertex.y <= 0 || vertex.y >= height) vertex.vy *= -1;
          vertex.x = Math.max(0, Math.min(width, vertex.x));
          vertex.y = Math.max(0, Math.min(height, vertex.y));
        }
        if (frame % 3 === 0) {
          shape.trail.push(shape.vertices.map(({ x, y }) => ({ x, y })));
          if (shape.trail.length > 8) shape.trail.shift();
        }
        shape.hue = (shape.hue + shape.hueSpeed) % 360;

        const copies = [...shape.trail, shape.vertices.map(({ x, y }) => ({ x, y }))];
        copies.forEach((points, index) => {
          const alpha = 0.25 + (index / copies.length) * 0.75;
          context.strokeStyle = `hsla(${(shape.hue + index * 6) % 360}, 100%, 55%, ${alpha})`;
          context.lineWidth = 1;
          context.beginPath();
          points.forEach((point, i) => {
            if (i === 0) context.moveTo(point.x, point.y);
            else context.lineTo(point.x, point.y);
          });
          context.closePath();
          context.stroke();
        });
      }
      raf = window.requestAnimationFrame(step);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    raf = window.requestAnimationFrame(step);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Idle overlay                                                        */
/* ------------------------------------------------------------------ */

export function ScreenSaverOverlay({ desktopVisible }: { desktopVisible: boolean }) {
  const [active, setActive] = useState(false);
  const [config, setConfig] = useState<SaverSettings>(getSaverSettings);

  useEffect(() => subscribeSaver(setConfig), []);

  // Idle detection: any input resets the countdown, or wakes the saver.
  useEffect(() => {
    if (!desktopVisible) {
      setActive(false);
      return;
    }

    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      if (config.saver === "none" || prefersReducedMotion()) return;
      timer = window.setTimeout(() => setActive(true), config.waitMinutes * 60_000);
    };

    const handleInput = () => {
      setActive((current) => {
        if (current) return false;
        return current;
      });
      arm();
    };

    const preview = () => setActive(true);

    const events = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((name) => window.addEventListener(name, handleInput, { passive: true }));
    window.addEventListener("maxxp:screensaver-preview", preview);
    arm();

    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, handleInput));
      window.removeEventListener("maxxp:screensaver-preview", preview);
    };
  }, [desktopVisible, config]);

  if (!active) return null;

  return (
    <div className="screensaver-overlay">
      <MystifyCanvas className="screensaver-canvas" />
    </div>
  );
}
