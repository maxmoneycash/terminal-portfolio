/** A stalled picture must not leave the native soundtrack running on its own. */
export const FRAME_STALL_MS = 1500;
export const BUFFER_STALL_MS = 8000;

export function playbackRecovery({ stalledFor, buffering, playing, hidden }: {
  stalledFor: number; buffering: boolean; playing: boolean; hidden: boolean;
}): "clock" | "media" | null {
  if (!playing || hidden) return null;
  if (buffering) return stalledFor >= BUFFER_STALL_MS ? "media" : null;
  return stalledFor >= FRAME_STALL_MS ? "clock" : null;
}

export function recoveryFrame(frame: number, soundtrackTime: number | undefined, duration: number, buffering: boolean) {
  // If audio continued, join what the visitor is hearing instead of replaying it.
  const audioFrame = soundtrackTime !== undefined && Number.isFinite(soundtrackTime) ? Math.floor(soundtrackTime * 30) : frame;
  return Math.max(0, Math.min(duration - 1, buffering ? frame : Math.max(frame, audioFrame)));
}
