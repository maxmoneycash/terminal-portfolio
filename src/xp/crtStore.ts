/**
 * CRT-effects preference as a tiny module store, so both the shell (taskbar,
 * menus, context menu) and the Display Properties dialog drive one source of
 * truth.
 */

const STORAGE_KEY = "maxxp:crt";

function readPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

let enabled = readPreference();
const listeners = new Set<(value: boolean) => void>();

export function getCrtEnabled() {
  return enabled;
}

export function setCrtEnabled(value: boolean) {
  if (enabled === value) return;
  enabled = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
  } catch {
    // The control still works when storage is unavailable.
  }
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
