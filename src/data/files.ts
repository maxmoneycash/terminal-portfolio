/**
 * Virtual filesystem behind the My Documents explorer window.
 *
 * Every document is generated from the same real portfolio data the rest of
 * the shell uses (src/data/portfolio.ts) — no lorem, no mock files. Folders
 * nest one level deep, which is all the Folders pane renders.
 */
import { portfolio } from "./portfolio";
import githubProjects from "./github-projects.json";
import publicActivity from "./github-public-activity.json";

export type ExplorerFile = {
  kind: "file";
  name: string;
  content: string;
};

export type ExplorerFolder = {
  kind: "folder";
  name: string;
  children: ExplorerNode[];
};

export type ExplorerNode = ExplorerFile | ExplorerFolder;

export const MY_DOCUMENTS_PATH = "C:\\Documents and Settings\\Max\\My Documents";

const DIVIDER = "=".repeat(58);

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function textFile(name: string, lines: Array<string | undefined | null>): ExplorerFile {
  return {
    kind: "file",
    name,
    content: lines.filter((line) => line !== undefined && line !== null).join("\n"),
  };
}

const aboutMe = textFile("about_me.txt", [
  portfolio.name.toUpperCase(),
  portfolio.title,
  portfolio.location,
  DIVIDER,
  "",
  portfolio.summary,
  "",
  "Focus areas:",
  ...portfolio.focus.map((item) => `  * ${item}`),
  "",
  "The short version: I work where product, Move contracts, and",
  "agent tooling meet. The through-line is shipping demos that feel",
  "real enough for a technical buyer to use, test, and critique.",
]);

const currentRole = portfolio.roles[0];

const now = textFile("now.txt", [
  "WHAT I'M WORKING ON RIGHT NOW",
  DIVIDER,
  "",
  `${currentRole.company} — ${currentRole.title}`,
  currentRole.period,
  "",
  currentRole.impact,
  "",
  "Also running commits.sh — a live velocity index and dev rank",
  "built from GitHub activity, streaming real-time token telemetry",
  "from 8 coding agents. 67B+ tokens tracked so far. You can watch",
  "the live feed in the Task Manager window on this desktop.",
]);

const skills = textFile("skills.txt", [
  "SKILLS & STACK",
  DIVIDER,
  "",
  "Core focus:",
  ...portfolio.focus.map((item) => `  * ${item}`),
  "",
  "Languages & runtimes:",
  "  * Move (Aptos), TypeScript, Solidity, Python",
  "",
  "What that looks like in practice:",
  "  * Move contracts: markets, transaction composition, rewards",
  "  * Trading infrastructure: TWAP + market maker strategies,",
  "    delegation-based trading, HFT demo benchmarks",
  "  * Agent tooling: MCP servers, simulate-first tx planning,",
  "    JSON plans that LLM agents can execute onchain",
  "  * Transpilers & analysis: Solidity AST -> Move v2, parser",
  "    validation, differential fuzzing",
]);

const projectFiles: ExplorerFile[] = portfolio.projects.map((project) =>
  textFile(`${slugify(project.name)}.txt`, [
    project.name.toUpperCase(),
    DIVIDER,
    "",
    `Stack:   ${project.stack}`,
    project.link ? `Link:    ${project.link}` : null,
    "",
    project.summary,
  ]),
);

/* ------------------------------------------------------------------ */
/* GitHub Repos: the full curated catalogue, including private repos   */
/* (metadata only — same data the My Projects window ships).           */
/* ------------------------------------------------------------------ */

type CatalogRepo = {
  owner: string;
  name: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  homepage: string | null;
  pushedAt: string;
  language: string | null;
  url: string;
  license: string | null;
  stars: number;
  forks: number;
};

const SINCE_JANUARY = "2026-01-01";

function repoKey(repo: { owner: string; name: string }) {
  return `${repo.owner}/${repo.name}`.toLowerCase();
}

/** Catalogue (incl. private metadata) overlaid with live public activity. */
function mergeRepositories(): CatalogRepo[] {
  const byKey = new Map<string, CatalogRepo>();
  for (const repo of githubProjects.repositories) byKey.set(repoKey(repo), repo);
  for (const repo of publicActivity.repositories) {
    const existing = byKey.get(repoKey(repo));
    if (!existing) {
      byKey.set(repoKey(repo), repo);
      continue;
    }
    // Keep catalogue stars/license; take the fresher public push + description.
    const newer = repo.pushedAt > existing.pushedAt;
    byKey.set(repoKey(repo), {
      ...existing,
      description: repo.description ?? existing.description,
      homepage: repo.homepage ?? existing.homepage,
      language: repo.language ?? existing.language,
      pushedAt: newer ? repo.pushedAt : existing.pushedAt,
      fork: repo.fork,
      archived: repo.archived,
      url: repo.url,
    });
  }
  return [...byKey.values()].sort((a, b) => +new Date(b.pushedAt) - +new Date(a.pushedAt));
}

const mergedRepositories = mergeRepositories();
const sinceJanuaryRepositories = mergedRepositories.filter((repo) => repo.pushedAt >= SINCE_JANUARY);

function pushDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function repoFile(repo: CatalogRepo, taken: Set<string>): ExplorerFile {
  const base = slugify(repo.name);
  const name = taken.has(`${base}.txt`) ? `${base}_${repo.owner.toLowerCase()}.txt` : `${base}.txt`;
  taken.add(name);

  const flags = [
    repo.private ? "Private" : "Public",
    repo.fork ? "Fork" : null,
    repo.archived ? "Archived" : null,
  ].filter(Boolean);

  return textFile(name, [
    repo.name.toUpperCase(),
    `${repo.owner}/${repo.name}`,
    DIVIDER,
    "",
    `Visibility: ${flags.join(" · ")}`,
    `Language:   ${repo.language ?? "n/a"}`,
    repo.license ? `License:    ${repo.license}` : null,
    repo.stars > 0 || repo.forks > 0 ? `GitHub:     ${repo.stars} stars · ${repo.forks} forks` : null,
    `Last push:  ${pushDateLabel(repo.pushedAt)}`,
    repo.private ? null : `Repo:       ${repo.url}`,
    repo.homepage ? `Live:       ${repo.homepage}` : null,
    "",
    repo.description ?? "(no description)",
  ]);
}

const repoNames = new Set<string>();
const repoCatalogFiles: ExplorerFile[] = mergedRepositories.map((repo) => repoFile(repo, repoNames));

const repoCount = mergedRepositories.length;
const privateRepoCount = mergedRepositories.filter((repo) => repo.private).length;
const newPublicCount = publicActivity.repositories.filter(
  (repo) => !githubProjects.repositories.some((known) => repoKey(known) === repoKey(repo)),
).length;

const repoCatalogReadme = textFile("_README.txt", [
  "GITHUB REPOS — THE FULL CATALOGUE",
  DIVIDER,
  "",
  `${repoCount} repositories across maxmoneycash and SeamMoney,`,
  `${privateRepoCount} of them private. One file per repo, newest push first.`,
  "",
  "Private repos show the same metadata the My Projects window",
  "ships — name, description, language, last push — never code.",
  `Public activity since January added ${newPublicCount} repos that`,
  "were not in the July catalogue snapshot.",
  "",
  `Private catalogue: ${pushDateLabel(githubProjects.generatedAt)}`,
  `Public activity:   ${pushDateLabel(publicActivity.generatedAt)}`,
]);

const sinceJanuaryNames = new Set<string>();
const sinceJanuaryFiles: ExplorerFile[] = sinceJanuaryRepositories.map((repo) =>
  repoFile(repo, sinceJanuaryNames),
);

const sinceJanuaryReadme = textFile("_README.txt", [
  "WORK SINCE JANUARY 2026",
  DIVIDER,
  "",
  `${sinceJanuaryRepositories.length} repositories with a push on or after`,
  "January 1, 2026 — the stuff actually being edited this year.",
  "",
  `${sinceJanuaryRepositories.filter((repo) => repo.private).length} private (from the July catalogue snapshot)`,
  `${sinceJanuaryRepositories.filter((repo) => !repo.private).length} public (live GitHub activity as of ${pushDateLabel(publicActivity.generatedAt)})`,
  "",
  "Newest push first. Click any file for the write-up.",
]);

/** Company files, deduped by appending the start year when names repeat. */
function roleFileName(company: string, period: string, taken: Set<string>) {
  const base = slugify(company);
  const year = period.match(/\d{4}/)?.[0] ?? "";
  const name = taken.has(`${base}.txt`) ? `${base}_${year}.txt` : `${base}.txt`;
  taken.add(name);
  return name;
}

const roleNames = new Set<string>();
const roleFiles: ExplorerFile[] = portfolio.roles.map((role) =>
  textFile(roleFileName(role.company, role.period, roleNames), [
    role.company.toUpperCase(),
    role.title,
    role.period,
    DIVIDER,
    "",
    role.impact,
  ]),
);

const education = textFile("education.txt", [
  "EDUCATION",
  DIVIDER,
  "",
  portfolio.education.school,
  `${portfolio.education.degree} · ${portfolio.education.period}`,
  portfolio.education.detail,
  "",
  "Honors:",
  ...portfolio.honors.map((honor) => `  * ${honor}`),
  "",
  "Organizations:",
  ...portfolio.organizations.map((org) => `  * ${org}`),
]);

const volunteering = textFile("volunteering.txt", [
  "VOLUNTEERING",
  DIVIDER,
  "",
  ...portfolio.volunteering.flatMap((entry) => [
    entry.org,
    entry.role,
    "",
    entry.detail,
  ]),
]);

const contact = textFile("contact.txt", [
  "CONTACT",
  DIVIDER,
  "",
  `Email:     ${portfolio.links.email.replace(/^mailto:/, "")}`,
  `GitHub:    ${portfolio.links.github}`,
  `LinkedIn:  ${portfolio.links.linkedin}`,
  "",
  "Email is the fastest way to reach me. Send context on the",
  "protocol, product, or workflow you want to ship.",
  "",
  "(The Contact Me window on this desktop pre-fills all of this.)",
]);

const uses = textFile("uses.txt", [
  "TOOLS I ACTUALLY USE",
  DIVIDER,
  "",
  "Editor & agents:",
  "  * Cursor + Claude for most day-to-day engineering",
  "  * 8 coding agents wired into commits.sh token telemetry",
  "",
  "Engineering:",
  "  * TypeScript, React, Vite",
  "  * Move CLI + Aptos tooling",
  "  * Git, Docker",
  "",
  "Media (for the demo reels on this site):",
  "  * OBS for screen capture",
  "  * DaVinci Resolve for cuts",
  "  * Blender for the 3D scenes",
]);

const readme = textFile("README.txt", [
  "MY DOCUMENTS — READ ME FIRST",
  DIVIDER,
  "",
  "This folder is the file cabinet of the portfolio. Everything in",
  "here is generated from the same real data as the rest of MaxXP:",
  "the resume, the GitHub catalogue, and the live telemetry.",
  "",
  "  * about_me.txt ......... who I am",
  "  * now.txt .............. what I'm working on right now",
  "  * skills.txt ........... stack and focus areas",
  "  * Projects\\ ............ write-ups of the featured projects",
  `  * Since January\\ ....... ${sinceJanuaryRepositories.length} repos pushed in 2026`,
  `  * GitHub Repos\\ ........ all ${repoCount} repos, incl. ${privateRepoCount} private ones`,
  "  * Work History\\ ........ one file per role, newest first",
  "  * contact.txt .......... how to reach me",
  "",
  "Click any file to open it in Notepad. Windows drag, resize,",
  "and stack — just like the real thing.",
]);

const howThisSiteWasMade = textFile("how_this_site_was_made.txt", [
  "HOW THIS SITE WAS MADE",
  DIVIDER,
  "",
  "MaxXP is a faithful Windows XP desktop built with React 19,",
  "TypeScript, and Vite. The design IS the product — the visitor's",
  '"how was this made?" is the deliverable.',
  "",
  "Under the hood:",
  "  * A real window manager: z-order, drag, 8-edge resize,",
  "    minimize-to-taskbar genie motion via WAAPI",
  "  * Luna chrome rebuilt from period screenshots — gradients,",
  "    Tahoma, balloon tips, Task Manager greens",
  "  * The Bliss wallpaper as an orientation-aware video loop",
  "  * XP sound scheme decoded into a shared AudioContext",
  "  * Demo reels served as HLS with poster-first loading",
  "  * Live commit + AI-token telemetry streamed from commits.sh",
  "",
  "Every window is wired to real content. No lorem, no mock stats.",
]);

const drosteNote = textFile("droste.txt", [
  "A NOTE ON RECURSION",
  DIVIDER,
  "",
  "You are reading a text file",
  "  inside a Notepad window",
  "    inside an Explorer window",
  "      inside a Windows XP desktop",
  "        inside a browser tab.",
  "",
  "Almost caused a Droste effect :D",
]);

export const myDocuments: ExplorerFolder = {
  kind: "folder",
  name: "My Documents",
  children: [
    { kind: "folder", name: "Projects", children: projectFiles },
    { kind: "folder", name: "Since January", children: [sinceJanuaryReadme, ...sinceJanuaryFiles] },
    { kind: "folder", name: "GitHub Repos", children: [repoCatalogReadme, ...repoCatalogFiles] },
    { kind: "folder", name: "Work History", children: [...roleFiles, education, volunteering] },
    readme,
    aboutMe,
    now,
    skills,
    uses,
    howThisSiteWasMade,
    contact,
    drosteNote,
  ],
};

/** Resolve a path of folder names (relative to My Documents) to its folder. */
export function resolveFolder(path: string[]): ExplorerFolder {
  let folder = myDocuments;
  for (const segment of path) {
    const next = folder.children.find(
      (child): child is ExplorerFolder => child.kind === "folder" && child.name === segment,
    );
    if (!next) return folder;
    folder = next;
  }
  return folder;
}

/** XP-style size label ("12.4 KB"). */
export function sizeLabel(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Rough on-disk size of a node, for the status bar and infotips. */
export function nodeSizeBytes(node: ExplorerNode): number {
  if (node.kind === "file") return node.content.length;
  return node.children.reduce((total, child) => total + nodeSizeBytes(child), 0);
}

export function folderSizeLabel(folder: ExplorerFolder): string {
  return sizeLabel(nodeSizeBytes(folder));
}
