/**
 * Shared types + constants for the MaxXP shell.
 *
 * The shell is a high-fidelity Windows XP (Luna) desktop simulator. Visual
 * metrics follow the Windows XP design language; module structure is ours.
 */

export const xp = "/xp";

export type AppId =
  | "signature"
  | "radio"
  | "quill"
  | "about"
  | "files"
  | "resume"
  | "projects"
  | "demos"
  | "contact"
  | "stats"
  | "minesweeper"
  | "recycle"
  | "display"
  | "browser";

export type BootPhase = "boot" | "login" | "welcome" | "desktop";

export type WindowRecord = {
  id: AppId;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
};

export type AppCatalogEntry = {
  title: string;
  shortTitle: string;
  icon: string;
  desktopLabel: string;
  status: string;
  dimensions: { width: number; height: number; minWidth: number; minHeight: number };
};

export const appCatalog: Record<AppId, AppCatalogEntry> = {
  browser: {
    title: "Internet Explorer",
    shortTitle: "Browser",
    icon: `${xp}/gui/desktop/projects.webp`,
    desktopLabel: "Internet Explorer",
    status: "Internet",
    dimensions: { width: 1100, height: 780, minWidth: 440, minHeight: 380 },
  },
  radio: {
    title: "KK6OQA Radio",
    shortTitle: "KK6OQA Radio",
    icon: `${xp}/gui/desktop/radio.svg`,
    desktopLabel: "KK6OQA Radio",
    status: "KK6OQA · 20 m CW · 73 de Max",
    dimensions: { width: 812, height: 530, minWidth: 360, minHeight: 360 },
  },
  quill: {
    title: "signature.bmp - Paint",
    shortTitle: "signature.bmp",
    icon: `${xp}/gui/start-menu/paint.webp`,
    desktopLabel: "Signature",
    status: "Click to write it again",
    dimensions: { width: 430, height: 210, minWidth: 260, minHeight: 150 },
  },
  signature: {
    title: "welcome.txt - Notepad",
    shortTitle: "Welcome",
    icon: `${xp}/gui/start-menu/notepad.webp`,
    desktopLabel: "Welcome Note",
    status: "Maxwell Mohammadi · Welcome to MaxXP",
    dimensions: { width: 720, height: 470, minWidth: 360, minHeight: 300 },
  },
  about: {
    title: "About Me",
    shortTitle: "About Me",
    icon: `${xp}/gui/desktop/about.webp`,
    desktopLabel: "About Me",
    status: "Learn more about Max",
    dimensions: { width: 790, height: 650, minWidth: 440, minHeight: 390 },
  },
  files: {
    title: "My Documents",
    shortTitle: "My Documents",
    icon: `${xp}/gui/toolbar/folder.webp`,
    desktopLabel: "My Documents",
    status: "Every file is real portfolio data — click a file to open it in Notepad",
    dimensions: { width: 840, height: 620, minWidth: 480, minHeight: 380 },
  },
  resume: {
    title: "My Resume",
    shortTitle: "My Resume",
    icon: `${xp}/gui/desktop/resume.webp`,
    desktopLabel: "My Resume",
    status: "Open or download the latest resume PDF",
    dimensions: { width: 720, height: 690, minWidth: 420, minHeight: 380 },
  },
  projects: {
    title: "My Projects",
    shortTitle: "My Projects",
    icon: `${xp}/gui/desktop/projects.webp`,
    desktopLabel: "My Projects",
    status: "Arrow keys move through the filmstrip",
    dimensions: { width: 860, height: 710, minWidth: 520, minHeight: 420 },
  },
  demos: {
    title: "Demo Reel",
    shortTitle: "Demo Reel",
    icon: `${xp}/gui/start-menu/mediaPlayer.webp`,
    desktopLabel: "Demo Reel",
    status: "Scroll the feed — every clip is a real screen recording",
    dimensions: { width: 900, height: 760, minWidth: 440, minHeight: 460 },
  },
  contact: {
    title: "Contact Me",
    shortTitle: "Contact Me",
    icon: `${xp}/gui/desktop/contact.webp`,
    desktopLabel: "Contact Me",
    status: "Email · GitHub · LinkedIn",
    dimensions: { width: 560, height: 390, minWidth: 420, minHeight: 300 },
  },
  stats: {
    title: "Task Manager",
    shortTitle: "Stats",
    icon: `${xp}/gui/start-menu/cmd.webp`,
    desktopLabel: "Dev Stats",
    status: "Live commit velocity and AI burn via commits.sh",
    dimensions: { width: 680, height: 780, minWidth: 470, minHeight: 430 },
  },
  minesweeper: {
    title: "Minesweeper",
    shortTitle: "Minesweeper",
    icon: `${xp}/gui/start-menu/minesweeper.svg`,
    desktopLabel: "Minesweeper",
    status: "Left-click reveals · right-click flags · the first click is always safe",
    dimensions: { width: 330, height: 430, minWidth: 300, minHeight: 360 },
  },
  recycle: {
    title: "Recycle Bin",
    shortTitle: "Recycle Bin",
    icon: `${xp}/gui/desktop/recycle-full.png`,
    desktopLabel: "Recycle Bin",
    status: "Every deletion in here was a real decision",
    dimensions: { width: 640, height: 470, minWidth: 460, minHeight: 360 },
  },
  display: {
    title: "Display Properties",
    shortTitle: "Display",
    icon: `${xp}/gui/desktop/display.png`,
    desktopLabel: "Display",
    status: "Wallpaper, screen saver, and CRT effects — changes apply immediately",
    dimensions: { width: 430, height: 540, minWidth: 390, minHeight: 480 },
  },
};

/** Icons shown on the desktop, top-to-bottom. */
export const desktopApps: AppId[] = ["projects", "radio", "demos", "about", "resume", "contact", "files", "recycle"];

export function externalLabel(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
