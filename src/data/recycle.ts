/**
 * Recycle Bin contents — every item is a real decision this site actually
 * deleted, with the date it happened. Emptying persists for the session and
 * swaps the desktop icon; "Put everything back" undoes it.
 */

export type RecycledItem = {
  name: string;
  origin: string;
  deletedOn: string;
  note: string;
};

export const recycledItems: RecycledItem[] = [
  {
    name: "smart_contract_engineer.txt",
    origin: "C:\\MaxXP\\boot screen",
    deletedOn: "August 20, 2026",
    note: "The old title, baked into the boot logo itself. Wrong emphasis — Product Engineer replaced it everywhere, pixels included.",
  },
  {
    name: "double_click_to_open.reg",
    origin: "C:\\MaxXP\\desktop",
    deletedOn: "August 20, 2026",
    note: "Desktop icons used to demand two clicks. Single-click opens won: point to select, one click to open.",
  },
  {
    name: "hand_drawn_cursor.svg",
    origin: "C:\\WINDOWS\\Cursors",
    deletedOn: "August 20, 2026",
    note: "An oversized arrow drawn from scratch in CSS. Replaced by the real Windows XP arrow.cur and hand.cur, correct hotspots and all.",
  },
  {
    name: "terminal_boot_portfolio",
    origin: "C:\\My Project\\maxmohammadi.com",
    deletedOn: "July 2026",
    note: "The previous site booted like a terminal (the repo is still named terminal-portfolio). MaxXP took its place.",
  },
  {
    name: "flat_minimal_redesign.fig",
    origin: "C:\\Documents and Settings\\Max\\Anti-references",
    deletedOn: "Never shipped",
    note: "A generic flat-design template. Rejected on principle: SaaS landing-page grammar has no place on this desktop.",
  },
];

const EMPTIED_KEY = "maxxp:recycle-emptied";

let emptied = readEmptied();
const listeners = new Set<(value: boolean) => void>();

function readEmptied() {
  try {
    return window.sessionStorage.getItem(EMPTIED_KEY) === "1";
  } catch {
    return false;
  }
}

export function isRecycleBinEmpty() {
  return emptied;
}

export function setRecycleBinEmpty(value: boolean) {
  if (emptied === value) return;
  emptied = value;
  try {
    if (value) window.sessionStorage.setItem(EMPTIED_KEY, "1");
    else window.sessionStorage.removeItem(EMPTIED_KEY);
  } catch {
    // Storage optional.
  }
  listeners.forEach((listener) => listener(emptied));
}

export function subscribeRecycleBin(listener: (empty: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function recycleBinIcon(empty: boolean) {
  return empty ? "/xp/gui/desktop/recycle-empty.png" : "/xp/gui/desktop/recycle-full.png";
}
