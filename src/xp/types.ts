/**
 * Shared types + constants for the MaxXP shell.
 *
 * The shell is a high-fidelity Windows XP (Luna) desktop simulator. Visual
 * metrics follow the Windows XP design language; module structure is ours.
 */

export const xp = "/xp";

export type AppId =
  | "signature"
  | "about"
  | "files"
  | "resume"
  | "projects"
  | "demos"
  | "contact"
  | "stats";

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
    status: "57 curated repositories across maxmoneycash and SeamMoney",
    dimensions: { width: 860, height: 710, minWidth: 520, minHeight: 420 },
  },
  demos: {
    title: "Demo Reel",
    shortTitle: "Demo Reel",
    icon: `${xp}/gui/start-menu/mediaPlayer.webp`,
    desktopLabel: "Demo Reel",
    status: "Scroll the feed — every clip is a real screen recording",
    dimensions: { width: 620, height: 740, minWidth: 440, minHeight: 460 },
  },
  contact: {
    title: "Contact Me",
    shortTitle: "Contact Me",
    icon: `${xp}/gui/desktop/contact.webp`,
    desktopLabel: "Contact Me",
    status: "Compose a message to Max",
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
};

/** Icons shown on the desktop, top-to-bottom. */
export const desktopApps: AppId[] = ["about", "files", "resume", "projects", "demos", "stats", "contact"];

export function externalLabel(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
