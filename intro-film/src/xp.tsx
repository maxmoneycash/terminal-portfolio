import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Audio, getInputProps, Img, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import clipManifest from "../clips.json";
import stillManifest from "../stills.json";
import { caretVisible, easeIn, easeInOut, easeOut, keyed, keyedPoint, progress, type Key, type Point } from "./lib";
import "./xp.css";

export const asset = (path: string) => staticFile(`xp/gui/${path}`);

/** The soundtrack pass skips every video: it only needs the <Sfx> cues. */
const AUDIO_ONLY = getInputProps().audioOnly === true;

export function useOrientation() {
  const { width, height } = useVideoConfig();
  return { W: width, H: height, portrait: height > width };
}

/* ------------------------------------------------------------------ */
/* Clips                                                               */
/* ------------------------------------------------------------------ */

type ClipId = keyof typeof clipManifest.clips;
export const clipInfo = (id: ClipId) => clipManifest.clips[id];

/** Aspect ratio (w / h) of a clip's reviewed crop. */
export const clipRatio = (id: ClipId) => clipInfo(id).crop[2] / clipInfo(id).crop[3];

/**
 * One reviewed recording. `from` skips into the clip (seconds); short clips
 * loop so a scene can hold them as long as it needs.
 */
export function Clip({ id, from = 0, fit = "contain", position = "50% 50%", style, thumb = false, rate = 1 }: {
  id: ClipId;
  from?: number;
  fit?: "cover" | "contain" | "fill";
  position?: string;
  style?: CSSProperties;
  /** Use the 640-wide copy (small windows). */
  thumb?: boolean;
  /** Playback speed (the timelapse runs a little faster on the beat grid). */
  rate?: number;
}) {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  if (AUDIO_ONLY) return null;
  const info = clipInfo(id);
  const speed = "speed" in info ? info.speed : 1;
  const length = Math.floor(info.duration / speed * fps) - 1;
  const trim = Math.min(Math.round(from * fps), length - 1);
  // Predecode demanding footage once instead of seeking a video per frame.
  // The complete source framing is retained; Chrome only composites the image.
  const useFrames = ("frames" in info && info.frames) || (height > width && "portraitFrames" in info && info.portraitFrames);
  if (useFrames && !thumb) {
    const index = trim + Math.floor(frame * rate) % (length - trim + 1);
    return <Img src={staticFile(`frames/${id}/${String(index).padStart(5, "0")}.jpg`)}
      style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: position, display: "block", ...style }} />;
  }
  const video = (
    <OffthreadVideo
      src={staticFile(`clips/${id}${thumb ? ".thumb" : ""}.mp4`)}
      trimBefore={trim}
      playbackRate={rate}
      muted
      style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: position, display: "block", ...style }}
    />
  );
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Loop durationInFrames={Math.max(1, Math.floor((length - trim) / rate))}>{video}</Loop>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Window                                                              */
/* ------------------------------------------------------------------ */

function Glyph({ kind }: { kind: "min" | "max" | "close" }) {
  if (kind === "min") {
    return (
      <svg viewBox="0 0 21 21">
        <rect x="5" y="13" width="7" height="3" fill="#fff" />
      </svg>
    );
  }
  if (kind === "max") {
    return (
      <svg viewBox="0 0 21 21">
        <rect x="5" y="5" width="11" height="11" fill="none" stroke="#fff" strokeWidth="1" />
        <rect x="5" y="5" width="11" height="3" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 21 21">
      <path d="M6 6 L15 15 M15 6 L6 15" stroke="#fff" strokeWidth="2.2" strokeLinecap="square" />
    </svg>
  );
}

export type WindowChrome = {
  menu?: string[];
  toolbar?: boolean;
  address?: ReactNode;
  status?: ReactNode;
};

export function Window({
  x, y, w, h, title, icon, active = true, chrome, children, bodyStyle, style, closeState, titleCaret, buttons = "all", titleStyle, appear,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: ReactNode;
  icon?: string;
  active?: boolean;
  chrome?: WindowChrome;
  children?: ReactNode;
  bodyStyle?: CSSProperties;
  style?: CSSProperties;
  closeState?: "hot" | "pressed";
  titleCaret?: boolean;
  buttons?: "all" | "close";
  titleStyle?: CSSProperties;
  /** Frame the window opened on: it zooms in from 92% over a few frames, as XP's did. */
  appear?: number;
}) {
  const frame = useCurrentFrame();
  const open = appear === undefined ? 1 : progress(frame, appear, 5, easeOut);
  const opening = open < 1 ? { opacity: 0.35 + 0.65 * open, transform: `scale(${0.92 + 0.08 * open})`, transformOrigin: "50% 40%" } : undefined;
  return (
    <div className={`xpw${active ? "" : " is-inactive"}`} style={{ left: x, top: y, width: w, height: h, ...opening, ...style }}>
      <div className="xpw-title" style={titleStyle}>
        {icon ? <Img className="xpw-icon" src={icon} /> : null}
        <span className="xpw-title-text">
          {title}
          {titleCaret ? <span style={{ opacity: caretVisible(frame) ? 1 : 0 }}>|</span> : null}
        </span>
        <span className="xpw-buttons">
          {buttons === "all" ? <i className="xpw-btn"><Glyph kind="min" /></i> : null}
          {buttons === "all" ? <i className="xpw-btn"><Glyph kind="max" /></i> : null}
          <i className={`xpw-btn close${closeState ? ` is-${closeState}` : ""}`}><Glyph kind="close" /></i>
        </span>
      </div>
      {chrome?.menu ? (
        <div className="xpw-menu">
          {chrome.menu.map((item) => <span key={item}>{item}</span>)}
        </div>
      ) : null}
      {chrome?.toolbar ? <IEToolbar /> : null}
      {chrome?.address !== undefined ? (
        <div className="xpw-address">
          <span>Address</span>
          <span className="xpw-address-field">
            <Img src={asset("start-menu/photos.webp")} style={{ width: 14, height: 14 }} />
            {chrome.address}
          </span>
          <span className="xpw-go">
            <Img src={asset("toolbar/go.webp")} style={{ width: 18, height: 18 }} />
            Go
          </span>
        </div>
      ) : null}
      <div className="xpw-body" style={bodyStyle}>{children}</div>
      {chrome?.status !== undefined ? <div className="xpw-status">{chrome.status}</div> : null}
    </div>
  );
}

function IEToolbar() {
  return (
    <div className="xpw-toolbar">
      <span className="xpw-tool"><Img src={asset("toolbar/back.webp")} />Back</span>
      <span className="xpw-tool"><Img src={asset("toolbar/forward.webp")} style={{ opacity: 0.45 }} /></span>
      <span className="xpw-tool">
        <svg className="glyph" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="#e23a22" stroke="#9c1a0b" />
          <path d="M8 8 L16 16 M16 8 L8 16" stroke="#fff" strokeWidth="2.6" />
        </svg>
      </span>
      <span className="xpw-tool">
        <svg className="glyph" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" fill="#fff" stroke="#8aa0b8" />
          <path d="M17 9 A6 6 0 1 0 17.5 14" fill="none" stroke="#2a9d38" strokeWidth="2.4" />
          <path d="M14 8 L18.5 8.5 L18 4" fill="none" stroke="#2a9d38" strokeWidth="2" />
        </svg>
      </span>
      <span className="xpw-tool"><Img src={asset("toolbar/home.webp")} /></span>
      <span className="xpw-sep" />
      <span className="xpw-tool">
        <svg className="glyph" viewBox="0 0 24 24">
          <circle cx="10" cy="10" r="6" fill="#bfe1ff" stroke="#1d5fa8" strokeWidth="2" />
          <path d="M14.5 14.5 L21 21" stroke="#6a4b26" strokeWidth="3.4" strokeLinecap="round" />
        </svg>
        Search
      </span>
      <span className="xpw-tool">
        <svg className="glyph" viewBox="0 0 24 24">
          <path d="M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z" fill="#ffd02e" stroke="#b07a00" />
        </svg>
        Favorites
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Balloon tip                                                         */
/* ------------------------------------------------------------------ */

export function Balloon({
  x, y, w, title, children, icon = "info", tailX, tailDir = "down", scale = 1, style,
}: {
  x: number;
  y: number;
  w: number;
  title?: ReactNode;
  children?: ReactNode;
  icon?: "info" | "error" | "shield" | "none";
  /** Tail tip position relative to the balloon's left edge. */
  tailX: number;
  tailDir?: "down" | "up" | "left";
  scale?: number;
  style?: CSSProperties;
}) {
  const iconSrc = icon === "info" ? asset("tray/info.webp") : icon === "error" ? asset("system/error.webp") : null;
  return (
    <div className="xpb" style={{ left: x, top: y, width: w, fontSize: 11 * scale, ...style }}>
      {title ? (
        <div className="xpb-title" style={{ fontSize: 11 * scale, gap: 7 * scale, marginBottom: 7 * scale }}>
          {iconSrc ? <Img src={iconSrc} style={{ width: 18 * scale, height: 18 * scale }} /> : null}
          {icon === "shield" ? <Shield size={18 * scale} /> : null}
          <span>{title}</span>
        </div>
      ) : null}
      <div style={{ lineHeight: 1.35 }}>{children}</div>
      <i className="xpb-close" style={{ transform: `scale(${scale})`, transformOrigin: "top right" }} />
      <BalloonTail x={tailX} dir={tailDir} />
    </div>
  );
}

function BalloonTail({ x, dir }: { x: number; dir: "down" | "up" | "left" }) {
  // Right-angled XP tail: vertical edge on the right, sloped edge on the left.
  const path = dir === "up" ? "M0 22 L22 0 L22 22" : "M0 0 L22 22 L22 0";
  const top = dir === "up" ? -22 : undefined;
  const bottom = dir === "down" ? -22 : undefined;
  return (
    <svg className="xpb-tail" width="24" height="23" viewBox="0 0 24 23" style={{ left: x - 22, top, bottom }}>
      <path d={path} fill="#ffffe1" stroke="#000" strokeWidth="1" />
      <rect x="0.6" y={dir === "up" ? 21.4 : -1} width="21" height="2.2" fill="#ffffe1" />
    </svg>
  );
}

export function Shield({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <path d="M10 1 L18 4 C18 11 15 16 10 19 C5 16 2 11 2 4 Z" fill="#e2332a" stroke="#7a0d08" />
      <path d="M10 1 L10 19 C15 16 18 11 18 4 Z" fill="#2f6fe0" stroke="#0c2f80" />
      <path d="M2 4 L10 1 L10 10 L2 10 Z" fill="#33a046" />
      <path d="M10 10 L18 10 C17.5 13 15 16.5 10 19 Z" fill="#f2c218" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Taskbar and desktop                                                 */
/* ------------------------------------------------------------------ */

export type TaskItem = { title: string; icon?: string; active?: boolean };

export function Taskbar({ tasks = [], clock = "2:14 AM", height = 30 }: { tasks?: TaskItem[]; clock?: string; height?: number }) {
  return (
    <div className="xpt" style={{ height }}>
      <div className="xpt-start">
        <Img src={asset("system/windows-flag.webp")} />
        start
      </div>
      <div className="xpt-tasks">
        {tasks.map((task, i) => (
          <div key={i} className={`xpt-task${task.active ? " is-active" : ""}`}>
            {task.icon ? <Img src={task.icon} /> : null}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</span>
          </div>
        ))}
      </div>
      <div className="xpt-tray">
        <Img src={asset("tray/volume.webp")} />
        <Img src={asset("tray/info.webp")} />
        <span>{clock}</span>
      </div>
    </div>
  );
}

/** Absolute film frame at which the current scene starts (set by Film). */
export const SceneStart = createContext(0);

/**
 * The live desktop's animated Bliss. Each scene joins the loop at its
 * absolute time, so the clouds carry on across cuts and into the handoff.
 */
export function Bliss({ style }: { style?: CSSProperties }) {
  const { portrait } = useOrientation();
  const start = useContext(SceneStart);
  if (AUDIO_ONLY) return null;
  return (
    <OffthreadVideo
      src={staticFile(`wallpaper-${portrait ? "portrait" : "landscape"}.mp4`)}
      trimBefore={start}
      muted
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }}
    />
  );
}

// Same icons, labels and order as the live MaxXP desktop (src/xp/types.ts).
const DESKTOP_ICONS = [
  { label: "My Projects", src: "desktop/projects.webp" },
  { label: "KK6OQA Radio", src: "desktop/radio.svg" },
  { label: "Demo Reel", src: "start-menu/mediaPlayer.webp" },
  { label: "About Me", src: "desktop/about.webp" },
  { label: "My Resume", src: "desktop/resume.webp" },
  { label: "Contact Me", src: "desktop/contact.webp" },
  { label: "My Documents", src: "toolbar/folder.webp" },
  { label: "Recycle Bin", src: "desktop/recycle-full.png" },
];

export function DesktopIcons() {
  const { portrait } = useOrientation();
  const step = portrait ? 84 : 78;
  return (
    <>
      {DESKTOP_ICONS.map((icon, i) => (
        <div key={icon.label} className="xpd-icon" style={{ left: 6, top: 10 + i * step }}>
          <Img src={asset(icon.src)} />
          <span>{icon.label}</span>
        </div>
      ))}
    </>
  );
}

/** The full XP desktop: Bliss, icons and a taskbar, with content above it. */
export function Desktop({ children, tasks, icons = true, taskbar = true, clock }: {
  children?: ReactNode;
  tasks?: TaskItem[];
  icons?: boolean;
  taskbar?: boolean;
  clock?: string;
}) {
  return (
    <AbsoluteFill className="film" style={{ overflow: "hidden", background: "#3a6ea5" }}>
      <Bliss />
      {icons ? <DesktopIcons /> : null}
      {children}
      {taskbar ? <Taskbar tasks={tasks} clock={clock} /> : null}
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Cursor                                                              */
/* ------------------------------------------------------------------ */

const HOTSPOT = { arrow: { x: 0, y: 0 }, hand: { x: 12, y: 5 } };

/**
 * A pixel-art XP cursor moving along keyed points. `clicks` lists frames at
 * which it presses (a brief squash plus XP's focus ring on the target).
 */
export function Cursor({ path, clicks = [], kind = "arrow", size = 32, shadow = true, style }: {
  path: Key<Point>[];
  clicks?: number[];
  kind?: "arrow" | "hand";
  size?: number;
  shadow?: boolean;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const p = keyedPoint(frame, path);
  const k = size / 32;
  const pressing = clicks.some((c) => frame >= c && frame < c + 4);
  const press = pressing ? 0.9 : 1;
  return (
    <>
      {clicks.map((c) => {
        const t = progress(frame, c, 12);
        if (frame < c || t >= 1) return null;
        const at = keyedPoint(c, path);
        const r = (14 + 40 * t) * Math.max(1, k * 0.5);
        return (
          <div
            key={c}
            style={{
              position: "absolute",
              left: at.x - r,
              top: at.y - r,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              border: `${Math.max(2, k)}px solid rgb(255 255 255 / ${0.85 * (1 - t)})`,
              boxShadow: `0 0 0 ${Math.max(1, k * 0.6)}px rgb(0 0 0 / ${0.25 * (1 - t)})`,
            }}
          />
        );
      })}
      <Img
        src={asset(`cursors/${kind}.png`)}
        style={{
          position: "absolute",
          left: p.x - HOTSPOT[kind].x * k,
          top: p.y - HOTSPOT[kind].y * k,
          width: size,
          height: size,
          imageRendering: "pixelated",
          transform: `scale(${press})`,
          transformOrigin: `${HOTSPOT[kind].x * k}px ${HOTSPOT[kind].y * k}px`,
          filter: shadow ? `drop-shadow(${2 * k}px ${3 * k}px ${Math.max(1, 2 * k)}px rgb(0 0 0 / 0.35))` : undefined,
          ...style,
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

export type Shot = { x: number; y: number; z: number };
export type Rect = { x: number; y: number; w: number; h: number };

/** The camera never zooms in: the whole XP screen, taskbar included, stays in view. */
export const zoomCap = (_portrait: boolean) => 1;

/** A shot showing all of `rect` plus a margin, never closer than the cap. */
export function shotOf(rect: Rect, W: number, H: number, portrait: boolean, margin = 24): Shot {
  const z = Math.max(1, Math.min(zoomCap(portrait), W / (rect.w + 2 * margin), H / (rect.h + 2 * margin)));
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, z };
}

/** The whole screen. */
export const wide = (W: number, H: number): Shot => ({ x: W / 2, y: H / 2, z: 1 });

/**
 * Frames a W×H world. Each key names the world point at the frame's centre
 * and a zoom; segments ease between keys.
 */
export function Camera({ keys, children, shake = 0, clamp = true }: {
  keys: Key<Shot>[];
  children: ReactNode;
  shake?: number;
  /** Keep the view inside the W×H world (no black edges when zoomed in). */
  clamp?: boolean;
}) {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const z = Math.min(zoomCap(portrait), keyed(frame, keys.map((k) => ({ f: k.f, v: k.v.z, ease: k.ease ?? easeInOut }))));
  let x = keyed(frame, keys.map((k) => ({ f: k.f, v: k.v.x, ease: k.ease ?? easeInOut })));
  let y = keyed(frame, keys.map((k) => ({ f: k.f, v: k.v.y, ease: k.ease ?? easeInOut })));
  if (clamp && z >= 1) {
    x = Math.min(Math.max(x, W / (2 * z)), W - W / (2 * z));
    y = Math.min(Math.max(y, H / (2 * z)), H - H / (2 * z));
  }
  const jx = shake ? Math.sin(frame * 1.7) * shake + Math.sin(frame * 0.63) * shake * 0.6 : 0;
  const jy = shake ? Math.cos(frame * 1.3) * shake * 0.8 : 0;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transformOrigin: "0 0",
          transform: `translate(${W / 2 + jx}px, ${H / 2 + jy}px) scale(${z}) translate(${-x}px, ${-y}px)`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog and buttons                                                  */
/* ------------------------------------------------------------------ */

export function XPButton({ children, state, width, style }: {
  children: ReactNode;
  state?: "default" | "hot" | "pressed";
  width?: number;
  style?: CSSProperties;
}) {
  return (
    <span className={`xpbtn${state ? ` is-${state}` : ""}`} style={{ minWidth: width, ...style }}>
      {children}
    </span>
  );
}

/** Wraps children so they appear at `at` with XP's instant pop plus a 2-frame settle. */
export function Pop({ at, children, until }: { at: number; children: ReactNode; until?: number }) {
  const frame = useCurrentFrame();
  if (frame < at || (until !== undefined && frame >= until)) return null;
  const t = progress(frame, at, 3);
  return <div style={{ position: "absolute", inset: 0, opacity: 0.6 + 0.4 * t, transform: `scale(${0.985 + 0.015 * t})`, transformOrigin: "50% 50%" }}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Windows that come and go                                            */
/* ------------------------------------------------------------------ */

export type Enter = "pop" | "left" | "right" | "top" | "bottom";
export type Exit = "minimize" | "close";
const ENTER_FRAMES = 7;
const EXIT_FRAMES = 7;

function easeOutBack(t: number) {
  const c = 1.45;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

/**
 * An XP window with an entrance and an exit: it pops open (or slides in from
 * an edge) at `at`, and from `out` minimizes into the taskbar (or closes).
 * Always laid out fully inside the frame; only the animation crosses it.
 */
export function AppWindow({ at, out, enter = "pop", exit = "minimize", taskX, chromeScale = 1, children, x, y, w, h, ...rest }: {
  at: number;
  out?: number;
  /** Draws the frame, title bar and buttons smaller, for dense grids; x/y/w/h stay in screen pixels. */
  chromeScale?: number;
  enter?: Enter;
  exit?: Exit;
  /** Where its taskbar button sits (x), for the minimize. */
  taskX?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  title: ReactNode;
  icon?: string;
  active?: boolean;
  chrome?: WindowChrome;
  children?: ReactNode;
  bodyStyle?: CSSProperties;
  buttons?: "all" | "close";
}) {
  const frame = useCurrentFrame();
  const { W, H } = useOrientation();
  if (frame < at || (out !== undefined && frame >= out + EXIT_FRAMES)) return null;
  const tIn = Math.min(1, (frame - at) / ENTER_FRAMES);
  const tOut = out === undefined || frame < out ? 0 : Math.min(1, (frame - out) / EXIT_FRAMES);
  let transform = "";
  let opacity = 1;
  if (tIn < 1) {
    const e = easeOut(tIn);
    if (enter === "pop") {
      transform = `scale(${0.78 + 0.22 * easeOutBack(tIn)})`;
      opacity = Math.min(1, tIn * 3);
    } else {
      const far = { left: -(x + w + 40), right: W - x + 40, top: -(y + h + 40), bottom: H - y + 40 }[enter];
      const d = (far * (1 - e)) / chromeScale;
      transform = enter === "left" || enter === "right" ? `translateX(${d}px)` : `translateY(${d}px)`;
    }
  }
  if (tOut > 0) {
    const e = easeIn(tOut);
    if (exit === "minimize") {
      const dx = (taskX ?? W / 2) - (x + w / 2);
      const dy = H - 15 - (y + h / 2);
      transform += ` translate(${(dx * e) / chromeScale}px, ${(dy * e) / chromeScale}px) scale(${1 - 0.9 * e})`;
      opacity = 1 - e * 0.85;
    } else {
      transform += ` scale(${1 - 0.08 * e})`;
      opacity = 1 - e;
    }
  }
  return (
    <Window
      x={x / chromeScale}
      y={y / chromeScale}
      w={w / chromeScale}
      h={h / chromeScale}
      {...rest}
      style={{ transform, opacity, transformOrigin: "50% 50%", ...(chromeScale !== 1 ? { zoom: chromeScale } : null) }}
    >
      {children}
    </Window>
  );
}

/** Hard cuts between shots on the beat: each shot plays from its own start. */
export function Montage({ shots, until }: { shots: { id: ClipId; at: number; from?: number }[]; until: number }) {
  return (
    <>
      {shots.map((shot, i) => (
        <Sequence key={`${shot.id}-${shot.at}`} from={shot.at} durationInFrames={Math.max(1, (shots[i + 1]?.at ?? until) - shot.at)} layout="none">
          <Clip id={shot.id} from={shot.from ?? 0} />
        </Sequence>
      ))}
    </>
  );
}

/** A window playing one recording, opening at `at` (frames). */
export function ClipWindow({ id, x, y, w, h, title, at = 0, from = 0, active = true, position, icon, fit, thumb }: {
  id: ClipId;
  x: number;
  y: number;
  w: number;
  /** Defaults to the recording's own shape, so nothing is letterboxed or cut. */
  h?: number;
  title: string;
  at?: number;
  from?: number;
  active?: boolean;
  position?: string;
  icon?: string;
  fit?: "cover" | "contain";
  thumb?: boolean;
}) {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <Window x={x} y={y} w={w} h={h ?? clipWindowHeight(id, w)} title={title} icon={icon ?? asset("desktop/projects.webp")} active={active} appear={at} bodyStyle={{ background: "#111" }}>
      <Clip id={id} from={from} position={position} fit={fit} thumb={thumb} />
    </Window>
  );
}

/** Window height (title bar + frame) that matches a recording's shape at width `w`. */
export const clipWindowHeight = (id: ClipId, w: number) => Math.round((w - 6) / clipRatio(id)) + 33;

export const posterOf = (id: ClipId) => staticFile(`clips/${id}.jpg`);

/**
 * A flattened window: frame, title bar and a still of its content. Used for
 * the trails and stacks where dozens of windows overlap.
 */
export function WindowStamp({ id, x, y, w, h, title, active = true }: {
  id: ClipId;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  active?: boolean;
}) {
  return (
    <div className={`xpw is-stamp${active ? "" : " is-inactive"}`} style={{ left: x, top: y, width: w, height: h }}>
      <div className="xpw-title">
        <span className="xpw-title-text">{title}</span>
        <span className="xpw-buttons">
          <i className="xpw-btn" />
          <i className="xpw-btn" />
          <i className="xpw-btn close"><Glyph kind="close" /></i>
        </span>
      </div>
      <div className="xpw-body" style={{ background: `#111 url(${posterOf(id)}) 50% 0% / cover no-repeat` }} />
    </div>
  );
}

export type SoundName =
  | "balloon" | "critical" | "ding" | "exclamation" | "login" | "logoff"
  | "menu" | "messenger" | "minimize" | "recycle" | "restore" | "shutdown" | "start";

/** One of the site's XP system sounds, starting at local frame `at`. */
const SFX_UNDER_MUSIC = 0.5;

export function Sfx({ at, name, volume = 0.55 }: { at: number; name: SoundName; volume?: number }) {
  return (
    <Sequence from={Math.round(at)} layout="none" name={`sfx:${name}`}>
      <Audio src={staticFile(`xp/sounds/${name}.mp3`)} volume={volume * SFX_UNDER_MUSIC} />
    </Sequence>
  );
}

/* ------------------------------------------------------------------ */
/* Screenshots                                                         */
/* ------------------------------------------------------------------ */

type StillId = keyof typeof stillManifest.stills;
export const stillInfo = (id: StillId) => stillManifest.stills[id];
export const stillRatio = (id: StillId) => stillInfo(id).crop[2] / stillInfo(id).crop[3];
/** Window height (title bar + frame + extra chrome) that matches a screenshot at width `w`. */
export const stillWindowHeight = (id: StillId, w: number, chrome = 33) => Math.round((w - 6) / stillRatio(id)) + chrome;

/** A reviewed app screenshot (crop of the original, see stills.json). */
export function Still({ id, fit = "contain", position = "50% 50%", style }: {
  id: StillId;
  fit?: "cover" | "contain";
  position?: string;
  style?: CSSProperties;
}) {
  return (
    <Img
      src={staticFile(`stills/${id}.jpg`)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit, objectPosition: position, ...style }}
    />
  );
}
