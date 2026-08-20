/**
 * CRT-effects preference as a tiny module store, so both the shell (taskbar,
 * menus, context menu) and the Display Properties dialog drive one source of
 * truth.
 */

let enabled = true;
const listeners = new Set<(value: boolean) => void>();

export function getCrtEnabled() {
  return enabled;
}

export function setCrtEnabled(value: boolean) {
  if (enabled === value) return;
  enabled = value;
  listeners.forEach((listener) => listener(enabled));
}

export function toggleCrtEnabled() {
  setCrtEnabled(!enabled);
}

export function subscribeCrt(listener: (value: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
