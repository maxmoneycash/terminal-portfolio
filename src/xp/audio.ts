/**
 * MaxXP shell audio hub.
 *
 * Behavior modeled on the classic XP sound scheme: cues are decoded once into
 * a shared AudioContext, unlocked by the first user gesture, and played
 * through per-cue gain nodes with bus floors so UI sounds stay audible at low
 * system volume.
 */

export type SfxId =
  | "login"
  | "logoff"
  | "shutdown"
  | "balloon"
  | "messenger"
  | "critical"
  | "exclamation"
  | "start"
  | "menu"
  | "minimize"
  | "restore"
  | "ding"
  | "recycle";

type Bus = "chrome" | "alert";

const SFX: Record<SfxId, { file: string; bus: Bus; level: number }> = {
  login: { file: "login", bus: "chrome", level: 0.9 },
  logoff: { file: "logoff", bus: "chrome", level: 0.9 },
  shutdown: { file: "shutdown", bus: "chrome", level: 0.9 },
  balloon: { file: "balloon", bus: "chrome", level: 1.0 },
  messenger: { file: "messenger", bus: "alert", level: 0.75 },
  critical: { file: "critical", bus: "alert", level: 0.7 },
  exclamation: { file: "exclamation", bus: "alert", level: 0.7 },
  start: { file: "start", bus: "chrome", level: 0.72 },
  menu: { file: "menu", bus: "chrome", level: 0.72 },
  minimize: { file: "minimize", bus: "chrome", level: 0.85 },
  restore: { file: "restore", bus: "chrome", level: 0.85 },
  ding: { file: "ding", bus: "chrome", level: 0.85 },
  recycle: { file: "recycle", bus: "chrome", level: 0.85 },
};

const FLOOR_CHROME = 0.35;
const FLOOR_ALERT = 0.45;
const GAIN_MAX = 1.5;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const buffers = new Map<SfxId, AudioBuffer>();
let decodeAllStarted = false;
let unlocked = false;

let volumePercent = 80;
const volumeListeners = new Set<(percent: number) => void>();

export function getSystemVolume() {
  return volumePercent;
}

export function setSystemVolume(percent: number) {
  volumePercent = Math.max(0, Math.min(100, Math.round(percent)));
  volumeListeners.forEach((listener) => listener(volumePercent));
}

export function subscribeVolume(listener: (percent: number) => void) {
  volumeListeners.add(listener);
  return () => volumeListeners.delete(listener);
}

function systemGain() {
  return Math.max(0, Math.min(1, volumePercent / 100));
}

function cueLevel(id: SfxId) {
  const cue = SFX[id];
  const gain = systemGain();
  if (gain <= 0) return 0;
  const floor = cue.bus === "alert" ? FLOOR_ALERT : FLOOR_CHROME;
  return Math.min(GAIN_MAX, cue.level * Math.max(gain, floor));
}

function ensureContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(ctx.destination);
  return ctx;
}

async function decodeCue(id: SfxId) {
  if (buffers.has(id)) return;
  const audio = ensureContext();
  if (!audio) return;
  try {
    const response = await fetch(`/xp/sounds/${SFX[id].file}.mp3`);
    const data = await response.arrayBuffer();
    const buffer = await audio.decodeAudioData(data);
    buffers.set(id, buffer);
  } catch {
    // Missing or undecodable cue: fail silently, UI must keep working.
  }
}

function decodeAll() {
  if (decodeAllStarted) return;
  decodeAllStarted = true;
  (Object.keys(SFX) as SfxId[]).forEach((id) => void decodeCue(id));
}

/**
 * Unlock the shared AudioContext. Bound automatically to the first
 * pointerdown/keydown; also safe to call explicitly from a gesture handler.
 */
export function unlockAudio() {
  const audio = ensureContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume().catch(() => {});
  if (!unlocked) {
    unlocked = true;
    // Gesture seal: a silent buffer satisfies autoplay policies.
    try {
      const seal = audio.createBufferSource();
      seal.buffer = audio.createBuffer(1, Math.max(64, Math.floor(0.025 * audio.sampleRate)), audio.sampleRate);
      const sealGain = audio.createGain();
      sealGain.gain.value = 0;
      seal.connect(sealGain).connect(audio.destination);
      seal.start(audio.currentTime + 0.03);
    } catch {
      // Non-fatal.
    }
    decodeAll();
  }
}

let gesturesBound = false;
export function bindAudioUnlockGestures() {
  if (gesturesBound) return;
  gesturesBound = true;
  const handler = () => unlockAudio();
  document.addEventListener("pointerdown", handler, { capture: true, passive: true });
  document.addEventListener("keydown", handler, { capture: true, passive: true });
}

/** Fire-and-forget playback of a shell cue. */
export function playSfx(id: SfxId) {
  const level = cueLevel(id);
  if (level <= 0) return;
  const audio = ensureContext();
  if (!audio || !masterGain) return;
  if (audio.state === "suspended") void audio.resume().catch(() => {});
  void decodeCue(id).then(() => {
    const buffer = buffers.get(id);
    if (!buffer || !ctx || !masterGain) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gainNode = ctx.createGain();
    const start = ctx.currentTime + 0.03;
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(level, start + 0.008); // soft attack
    source.connect(gainNode).connect(masterGain);
    source.onended = () => {
      source.disconnect();
      gainNode.disconnect();
    };
    source.start(start);
  });
}

const stingsPlaying = new Set<SfxId>();

/**
 * Play a long sting (login/shutdown) and resolve when it finishes, bounded
 * by `maxMs`. Resolves immediately when the cue is muted or unavailable.
 */
export async function playStingAndWait(id: SfxId, maxMs: number, endPadMs = 150): Promise<void> {
  if (cueLevel(id) <= 0) return;
  if (stingsPlaying.has(id)) return;
  stingsPlaying.add(id);
  try {
    unlockAudio();
    await decodeCue(id);
    const buffer = buffers.get(id);
    playSfx(id);
    const durationMs = buffer ? buffer.duration * 1000 : 0;
    const wait = Math.min(maxMs, durationMs + endPadMs + 30);
    if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
  } finally {
    stingsPlaying.delete(id);
  }
}
