import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Terminal, useTerminal } from "@wterm/react";
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import { computeTimeline } from "tegaki";
import parisienne from "tegaki/fonts/parisienne";
import type { HistoryEvent } from "@etareduction/humantypingts";
import "@wterm/react/css";
import { portfolio } from "./data/portfolio";
import {
  applyCubeMove,
  applyCubeMoves,
  createSolvedCube,
  generateCubeScramble,
  invertCubeMoves,
  parseCubeMoves,
  type RubiksCubeState,
} from "./lib/rubiks";
import { RubiksThreeOverlay } from "./components/RubiksThreeOverlay";
import { SetupThreeOverlay } from "./components/SetupThreeOverlay";

const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

const newline = "\r\n";

const availableCommands = [
  "?",
  "about",
  "cat",
  "clear",
  "contact",
  "cube",
  "desk",
  "experience",
  "guide",
  "help",
  "hint",
  "intro",
  "links",
  "ls",
  "mail",
  "map",
  "neofetch",
  "next",
  "now",
  "open",
  "proof",
  "projects",
  "pwd",
  "repos",
  "resume",
  "sign",
  "signature",
  "setup",
  "skills",
  "status",
  "theme",
  "timeline",
  "whoami",
] as const;

type TerminalTheme = "logue" | "paper" | "midnight";
type PortfolioCommand = (typeof availableCommands)[number];
type CubeMode = "ready" | "scrambling" | "scrambled" | "solving" | "solved";

const commandExamples = [
  ...availableCommands,
  "cat about.md",
  "cat contact.txt",
  "cat experience.log",
  "cat proof.links",
  "cat resume.txt",
  "cat skills.json",
  "cat timeline.log",
  "cube on",
  "cube scramble",
  "cube scramble 25",
  "cube solve",
  "cube hide",
  "cube reset",
  "cube R U R' U'",
  "desk",
  "intro",
  "setup",
  "setup hide",
  "setup source",
  "open github",
  "open linkedin",
  "open resume",
  "now",
  "proof",
  "repos",
  "resume full",
  "resume work",
  "resume projects",
  "resume links",
  "resume pdf",
  "timeline",
  "theme logue",
  "theme midnight",
  "theme paper",
] as const;

const cubeReferenceUrl = "https://github.com/Ofunrein/dictators-rubikscube";
const realisticCubeAssetPath = "public/rubiks-realistic/realistic-rubiks-cube.blend";
const realisticCubeGlbPath = "public/rubiks-realistic/realistic-rubiks-cube.glb";

function color(text: string, value: keyof typeof ansi) {
  return `${ansi[value]}${text}${ansi.reset}`;
}

function headline(text: string) {
  return `${ansi.bold}${ansi.cyan}${text}${ansi.reset}`;
}

function pad(label: string, size = 8) {
  return label.padEnd(size, " ");
}

function wrapWords(text: string, width = 30) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }

  if (current) lines.push(current);
  return lines;
}

const ansiPattern = /\x1b\[[0-9;]*m/g;
const panelWidth = 72;
const terminalTextFont = `500 15px "Fira Code Local", "SFMono-Regular", Menlo, Consolas, monospace`;
const signatureAssetPath = "/maxwell_mohammadi_signature_full_canvas.svg";
const signatureQuillAssetPath = "/quill-pen-transparent.png";
const signatureText = "Maxwell Mohammadi";
const signatureViewBox = { width: 2048, height: 512 };
const signatureTimeline = computeTimeline(signatureText, parisienne, { glyphGap: 0.04, wordGap: 0.08 });
const signatureDrawDurationMs = Math.round(
  Math.max(2200, Math.min(2800, signatureTimeline.totalDuration * 130)),
);

type SignatureInkMap = {
  width: number;
  height: number;
  minX: number;
  maxX: number;
  hasInk: Uint8Array;
  centerYByX: Float32Array;
  previousInkByX: Int32Array;
  nextInkByX: Int32Array;
};

type SignaturePenPoint = {
  x: number;
  y: number;
  angle: number;
};

let signatureInkMapPromise: Promise<SignatureInkMap> | null = null;

const guideSteps = [
  { command: "projects", label: "selected work", detail: "Inspect shipped work and the product problems behind it." },
  { command: "resume", label: "terminal resume", detail: "Read the resume as a command-native dossier." },
  { command: "about", label: "profile", detail: "Read the short version of who Max is and how he works." },
  { command: "skills", label: "stack map", detail: "Scan the technical strengths and interface craft." },
  { command: "experience", label: "impact", detail: "Review roles, scope, and practical outcomes." },
  { command: "contact", label: "links", detail: "Find email, GitHub, LinkedIn, and resume links." },
] as const;

const proofLinks = [
  {
    label: "Decibrrr",
    url: "https://github.com/SeamMoney/decibrrr",
    detail: "Decibel trading automation with TWAP, market maker paths, delegation, live bot state, and wallet flows.",
  },
  {
    label: "Shelby content rewards",
    url: "https://github.com/SeamMoney/shelby-content-rewards",
    detail: "Shelby Protocol content rewards and structured agent workflows for protocol actions.",
  },
  {
    label: "Aptos Polymarket",
    url: "https://aptos-polymarket.vercel.app/",
    detail: "Prediction market demo with Move contracts, live trade streams, TPS dashboard, and HFT bot visualization.",
  },
  {
    label: "Whop Finance",
    url: "https://whop.finance/",
    detail: "Aptos finance demo for payments, yield, cross-chain transfers, investing, and agent banking flows.",
  },
  {
    label: "Sol2Move",
    url: "https://github.com/SeamMoney/aptos-move-transpiler",
    detail: "Solidity AST to IR to Move AST to Move v2 compiler with parser validation and differential fuzzing.",
  },
  {
    label: "Sol2Move app",
    url: "https://github.com/SeamMoney/sol2move-app",
    detail: "Web interface for reviewing Solidity to Aptos Move transpilation output.",
  },
  {
    label: "tx-composer",
    url: "https://github.com/SeamMoney/tx-composer",
    detail: "Simulate-first Aptos transaction composition with Move call wiring, VM error diagnosis, and JSON plans.",
  },
] as const;

function visibleLength(text: string) {
  return text.replace(ansiPattern, "").length;
}

function padVisible(text: string, width: number) {
  const gap = width - visibleLength(text);
  return gap > 0 ? `${text}${" ".repeat(gap)}` : text;
}

function pretextWrap(text: string, width = 58) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];

  try {
    const prepared = prepareWithSegments(normalized, terminalTextFont, { letterSpacing: 0 });
    const result = layoutWithLines(prepared, width * 8.6, 20);
    const lines = result.lines.map((line) => line.text.trimEnd()).filter(Boolean);
    if (lines.length > 0) return lines;
  } catch {
    // Canvas text measurement can fail in non-browser test environments.
  }

  return wrapWords(normalized, width);
}

function terminalPanel(title: string, rows: string[], width = panelWidth) {
  const innerWidth = width - 4;
  const safeRows = rows.flatMap((row) => {
    if (visibleLength(row) <= innerWidth) return row;
    return pretextWrap(row.replace(ansiPattern, ""), innerWidth);
  });
  const heading = ` ${title} `;
  const top = `+--${heading}${"-".repeat(Math.max(0, width - 4 - heading.length))}+`;
  const bottom = `+${"-".repeat(width - 2)}+`;

  return [
    top,
    ...safeRows.map((row) => `| ${padVisible(row, innerWidth)} |`),
    bottom,
  ].join(newline);
}

function commandRow(command: string, label: string) {
  return `${padVisible(color(command, "green"), Math.max(18, command.length + 2))}${label}`;
}

function hasVisitedCommand(visited: ReadonlySet<string>, command: string) {
  return visited.has(command) || (command === "about" && visited.has("whoami"));
}

function nextGuideStep(visited: ReadonlySet<string>) {
  return guideSteps.find((step) => !hasVisitedCommand(visited, step.command));
}

function guideOutput(visited: ReadonlySet<string>) {
  const nextStep = nextGuideStep(visited);
  const routeRows = guideSteps.map((step) => {
    const mark = hasVisitedCommand(visited, step.command) ? "x" : nextStep?.command === step.command ? ">" : " ";
    return `[${mark}] ${pad(step.command, 11)}${step.label}`;
  });
  const completedCount = guideSteps.filter((step) => hasVisitedCommand(visited, step.command)).length;
  const progress = `${"#".repeat(completedCount)}${"-".repeat(guideSteps.length - completedCount)}`;

  return terminalPanel("guided route", [
    ...pretextWrap(
      "This is a command-first portfolio. The terminal keeps the route short, then offers useful side quests only when they make sense.",
      64,
    ),
    "",
    `${pad("progress", 11)}[${progress}] ${completedCount}/${guideSteps.length}`,
    "",
    ...routeRows,
    "",
    nextStep
      ? `next: type ${color(nextStep.command, "green")} - ${nextStep.detail}`
      : `route complete: type ${color("contact", "green")} or ${color("open github", "green")}`,
    "keys: Tab completes examples. Up/Down recalls commands.",
  ]);
}

function nextOutput(visited: ReadonlySet<string>) {
  const step = nextGuideStep(visited);
  if (!step) {
    return terminalPanel("next", [
      "The guided route is complete.",
      commandRow("contact", "show direct links"),
      commandRow("open github", "open the GitHub profile"),
      commandRow("clear", "reset the screen"),
    ]);
  }

  return terminalPanel("next", [
    ...pretextWrap(step.detail, 64),
    "",
    `${pad("type", 8)}${color(step.command, "green")}`,
    `${pad("then", 8)}next`,
  ]);
}

function mapOutput(visited: ReadonlySet<string>) {
  const route = guideSteps
    .map((step) => (hasVisitedCommand(visited, step.command) ? `[${step.command}]` : step.command))
    .join(" -> ");

  return terminalPanel("command map", [
    route,
    "",
    commandRow("guide", "show this route with progress"),
    commandRow("next", "print the next useful command"),
    commandRow("hint", "context-aware suggestions"),
    commandRow("signature", "draw the handwritten mark"),
    commandRow("intro", "human-typed about.max.ts"),
    commandRow("resume", "terminal-native resume"),
    commandRow("proof", "live demos and repo links"),
    commandRow("timeline", "career path with dates"),
    commandRow("cube", "floating cube controls"),
    commandRow("setup", "MacBook + custom 60% keyboard"),
    commandRow("ls", "show portfolio files"),
    commandRow("cat about.md", "read a file-style entry"),
    commandRow("open resume", "open the resume link"),
  ]);
}

function hintOutput(visited: ReadonlySet<string>, cubeVisible: boolean, cubeHasHistory: boolean) {
  const nextStep = nextGuideStep(visited);
  const routeHint = nextStep
    ? commandRow(nextStep.command, nextStep.detail)
    : commandRow("contact", "route complete; open a direct channel");
  const cubeHint = cubeHasHistory
    ? commandRow("cube solve", "animate the inverse of the current scramble")
    : cubeVisible
      ? commandRow("cube scramble", "queue a fresh animated scramble")
      : commandRow("cube", "open the floating cube controller");

  return terminalPanel("coach", [
    "Two useful next moves:",
    "",
    routeHint,
    cubeHint,
    "",
    "Tab completes full examples like cube scramble, cat about.md, and open github.",
  ]);
}

function moveListRows(label: string, moves: readonly string[], width = 56) {
  if (moves.length === 0) return [`${pad(label, 10)}none`];
  const wrapped = wrapWords(moves.join(" "), width);
  return wrapped.map((line, index) => `${index === 0 ? pad(label, 10) : pad("", 10)}${line}`);
}

function cubeIntroOutput(mode: CubeMode, hasHistory: boolean) {
  const nextMove = hasHistory ? "cube solve" : "cube scramble";
  return terminalPanel("cube lab", [
    ...pretextWrap(
      "The floating cube is driven from this shell. It is not a click toy: command it, watch it move, then use the terminal to solve or hide it.",
      64,
    ),
    "",
    commandRow("cube scramble", "generate and animate a scramble"),
    commandRow("cube solve", "reverse the current scramble"),
    commandRow("cube R U R' U'", "apply exact moves"),
    commandRow("cube reset", "return to solved state"),
    commandRow("cube hide", "remove the overlay"),
    "",
    `${pad("state", 10)}${mode}`,
    `${pad("try", 10)}${color(nextMove, "green")}`,
  ]);
}

function cubeScrambleOutput(moves: readonly string[], solution: readonly string[]) {
  return terminalPanel("cube scramble", [
    "Scramble queued on the floating cube.",
    "",
    ...moveListRows("moves", moves),
    ...moveListRows("solver", solution),
    "",
    `${pad("next", 10)}${color("cube solve", "green")}`,
  ]);
}

function cubeSolveOutput(moves: readonly string[]) {
  return terminalPanel("cube solve", [
    moves.length > 0 ? "Solver queued. It plays the inverse sequence from the current state." : "Cube is already solved.",
    "",
    ...moveListRows("moves", moves),
    "",
    `${pad("next", 10)}${color("cube scramble", "green")}`,
  ]);
}

function cubeMoveOutput(moves: readonly string[]) {
  return terminalPanel("cube moves", [
    "Custom moves queued on the floating cube.",
    "",
    ...moveListRows("moves", moves),
    "",
    `${pad("undo", 10)}${invertCubeMoves(moves).join(" ")}`,
  ]);
}

function cubeResetOutput() {
  return terminalPanel("cube reset", [
    "Cube returned to solved state.",
    "",
    commandRow("cube scramble", "start a fresh scramble"),
    commandRow("cube hide", "remove the overlay"),
  ]);
}

function cubeHiddenOutput() {
  return terminalPanel("cube hidden", [
    "The cube overlay is off. The command state is still available.",
    "",
    commandRow("cube", "show controls again"),
    commandRow("cube scramble", "show and scramble it"),
  ]);
}

function cubeSourceOutput() {
  return terminalPanel("cube source", [
    "Visual source:",
    realisticCubeAssetPath,
    realisticCubeGlbPath,
    "public/rubiks-realistic/fingerprints-roughness.jpg",
    "public/rubiks-realistic/cayley-interior-1k.hdr",
    "",
    "Interaction reference:",
    cubeReferenceUrl,
    "",
    "The Blender file is kept with the app assets and exported to GLB for the browser. The face-turn rig wraps the exported cubies so the real model can still move.",
  ]);
}

function cubeErrorOutput(message: string) {
  return terminalPanel("cube usage", [
    color(message, "yellow"),
    "",
    commandRow("cube scramble", "generate a scramble"),
    commandRow("cube solve", "solve current scramble"),
    commandRow("cube R U R' U'", "manual move sequence"),
  ]);
}

function setupOutput() {
  return terminalPanel("setup scene", [
    ...pretextWrap(
      "Loading the MacBook model and a custom 60% keyboard. The keyboard is procedural so the matte-white caps, animated rainbow backlight, and red M A X caps can be controlled live.",
      64,
    ),
    "",
    commandRow("setup hide", "remove the 3D setup overlay"),
    commandRow("setup source", "show model and KeySim references"),
  ]);
}

function setupHiddenOutput() {
  return terminalPanel("setup hidden", [
    "The 3D setup overlay is off.",
    "",
    commandRow("setup", "show MacBook and keyboard scene"),
  ]);
}

function setupSourceOutput() {
  return terminalPanel("setup sources", [
    "MacBook model: Apple MacBook Pro 16 inch 2021 by jc1245",
    "https://sketchfab.com/3d-models/apple-macbook-pro-16-inch-2021-6a42b31bac064b00a91fbfebec07c852",
    "",
    "Keyboard layout/material inspiration:",
    "https://github.com/crsnbrt/keysim",
  ]);
}

function contextualNudge(name: string, visited: ReadonlySet<string>, cubeVisible: boolean, cubeHasHistory: boolean) {
  const quietCommands = new Set([
    "?",
    "clear",
    "cube",
    "desk",
    "guide",
    "help",
    "hint",
    "mail",
    "map",
    "next",
    "now",
    "open",
    "proof",
    "repos",
    "setup",
    "theme",
    "timeline",
  ]);
  if (quietCommands.has(name)) return "";

  const nextStep = nextGuideStep(visited);
  const route = nextStep ? `next ${nextStep.command}` : "route complete";
  const cube = cubeHasHistory ? "cube solve" : cubeVisible ? "cube scramble" : "cube";
  return `${ansi.dim}coach: ${route} | side quest ${cube}${ansi.reset}`;
}

function completionCandidates(current: string) {
  const normalized = current.trimStart().toLowerCase();
  if (!normalized) return availableCommands;
  if (!normalized.includes(" ")) {
    return availableCommands.filter((candidate) => candidate.toLowerCase().startsWith(normalized));
  }

  return commandExamples.filter((candidate) => candidate.toLowerCase().startsWith(normalized));
}

function completionOutput(current: string, matches: readonly string[]) {
  const listed = matches.length > 0 ? matches.join("  ") : "no matches";
  return terminalPanel("completion", [
    current ? `${pad("input", 8)}${current}` : `${pad("input", 8)}empty`,
    `${pad("matches", 8)}${listed}`,
    "",
    matches.length > 1 ? "Keep typing to narrow it, or press Tab again after a unique prefix." : "Press Enter to run it.",
  ]);
}

function typingIntroOutput() {
  return [
    `${color("human typing", "yellow")}: composing ./about.max.ts`,
    `${ansi.dim}The text below is generated through HumanTypingTS timing, errors, corrections, and pauses.${ansi.reset}`,
    "",
  ].join(newline);
}

function editDistance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, row) =>
    Array.from({ length: right.length + 1 }, (_, column) => (row === 0 ? column : column === 0 ? row : 0)),
  );

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost,
      );
    }
  }

  return rows[left.length][right.length];
}

function suggestCommand(command: string) {
  const name = command.split(/\s+/)[0]?.toLowerCase() ?? "";
  const prefixMatch = availableCommands.find((item) => item.startsWith(name));
  if (prefixMatch) return prefixMatch;

  const scored = availableCommands
    .filter((item) => item !== "?")
    .map((item) => ({ item, score: editDistance(name, item) }))
    .sort((left, right) => left.score - right.score);
  const best = scored[0];
  return best && best.score <= Math.max(2, Math.floor(name.length / 3)) ? best.item : null;
}

function field(label: string, value: string, width = 30) {
  return wrapWords(value, width)
    .map((line, index) => `${index === 0 ? pad(label) : pad("")}${line}`)
    .join(newline);
}

function bootOutput() {
  return [
    `${ansi.cyan}M A X   M O H A M M A D I${ansi.reset}`,
    `${ansi.dim}v. terminal portfolio / local runtime${ansi.reset}`,
    "",
    `${ansi.bold}${portfolio.name}${ansi.reset} // ${portfolio.title}`,
    `${ansi.dim}${portfolio.location}${ansi.reset}`,
    "",
    terminalPanel("start here", [
      ...pretextWrap(
        "The fire is idle ambience. It disappears as soon as you start typing, so the terminal becomes the interface instead of a backdrop.",
        64,
      ),
      "",
      commandRow("guide", "guided tour with progress"),
      commandRow("projects", "selected work"),
      commandRow("cube", "floating scrambler + solver"),
      commandRow("setup", "MacBook + custom keyboard scene"),
      commandRow("resume", "terminal resume dashboard"),
      commandRow("proof", "demos and repo evidence"),
      commandRow("intro", "type out the about program"),
      commandRow("signature", "draw the handwritten mark"),
      commandRow("about", "profile"),
      commandRow("contact", "links and email"),
      commandRow("hint", "tell me what to try next"),
      "",
      "Tab completes. Up/Down recalls commands.",
    ]),
    "",
    `${color("try", "yellow")}: ${color("guide", "green")} or ${color("resume", "green")}`,
    "",
  ].join(newline);
}

function helpOutput(visited: ReadonlySet<string>) {
  return [
    terminalPanel("command deck", [
      commandRow("guide", "guided route through the portfolio"),
      commandRow("next", "next recommended command"),
      commandRow("hint", "context-aware suggestions"),
      commandRow("map", "route and shortcuts"),
      commandRow("signature", "draw the handwritten mark"),
      commandRow("intro", "HumanTypingTS about program"),
      commandRow("resume", "terminal-native resume"),
      commandRow("resume work", "role history with key achievements"),
      commandRow("resume projects", "project detail and visible URLs"),
      commandRow("proof", "demos and repo links"),
      commandRow("timeline", "career path with dates"),
      commandRow("cube", "floating Rubik's cube controller"),
      commandRow("setup", "MacBook + matte-white keyboard scene"),
      "",
      commandRow("about", "profile snapshot"),
      commandRow("projects", "selected work"),
      commandRow("experience", "roles and impact"),
      commandRow("skills", "toolchain and focus"),
      commandRow("contact", "email and social links"),
      commandRow("links", "raw link list"),
      "",
      commandRow("ls", "portfolio files"),
      commandRow("cat", "read about.md, contact.txt, skills.json, experience.log"),
      commandRow("neofetch", "compact portfolio card"),
      commandRow("theme", "logue | paper | midnight"),
      commandRow("open", "github | linkedin | resume"),
      commandRow("clear", "wipe the screen"),
      commandRow("cube source", "show cube model assets"),
    ]),
    "",
    nextOutput(visited),
  ].join(newline);
}

function lsOutput() {
  return [
    `${color("about.md", "cyan")}       ${color("projects/", "blue")}      ${color("experience.log", "yellow")}`,
    `${color("skills.json", "green")}    ${color("contact.txt", "magenta")}    ${color("resume.txt", "white")}`,
    `${color("proof.links", "cyan")}    ${color("timeline.log", "yellow")}`,
  ].join(newline);
}

function aboutOutput() {
  return [
    headline(portfolio.name),
    `${pad("role")}${portfolio.title}`,
    `${pad("base")}${portfolio.location}`,
    "",
    field("", portfolio.summary, 34),
  ].join(newline);
}

function aboutProgramSource() {
  return [
    "type MaxMohammadi = {",
    '  role: "smart contract engineer";',
    '  base: "Palo Alto / San Francisco Bay Area";',
    "  focus: string[];",
    "};",
    "",
    "const max: MaxMohammadi = {",
    '  role: "smart contract engineer",',
    '  base: "Palo Alto / San Francisco Bay Area",',
    "  focus: [",
    '    "Aptos Move systems",',
    '    "LLM MCP servers for trading protocols",',
    '    "high-throughput onchain markets",',
    "  ],",
    "};",
    "",
    "export function about() {",
    '  return "Max builds Aptos products, agent tooling, and onchain trading systems."; ',
    "}",
  ].join("\n");
}

function projectsOutput() {
  return [
    headline("selected work"),
    ...portfolio.projects.flatMap((project, index) => [
      "",
      `${color(`${index + 1}. ${project.name}`, "yellow")}`,
      field("stack", project.stack),
      field("ship", project.summary),
      project.link ? `${pad("url")}${project.link}` : "",
    ]),
  ].join(newline);
}

function experienceOutput() {
  return [
    headline("experience"),
    ...portfolio.roles.flatMap((role) => [
      "",
      `${color(role.title, "yellow")} @ ${role.company}`,
      `${pad("period")}${role.period}`,
      field("impact", role.impact),
    ]),
  ].join(newline);
}

function skillsOutput() {
  return [
    headline("focus map"),
    ...portfolio.focus.map((item, index) => {
      const marks = ["[########--]", "[#######---]", "[#########-]", "[#######---]"];
      return `${color(marks[index] ?? "[######----]", "green")}  ${item}`;
    }),
  ].join(newline);
}

function contactOutput() {
  return [
    headline("contact"),
    `${pad("email")}${portfolio.links.email.replace("mailto:", "")}`,
    `${pad("github")}${portfolio.links.github}`,
    `${pad("linkedin")}${portfolio.links.linkedin}`,
    `${pad("resume")}${portfolio.links.resume}`,
  ].join(newline);
}

function linksOutput() {
  return [
    headline("links"),
    `${pad("github")}${portfolio.links.github}`,
    `${pad("linkedin")}${portfolio.links.linkedin}`,
    `${pad("resume")}${portfolio.links.resume}`,
  ].join(newline);
}

function metric(label: string, value: string, detail: string) {
  return `${padVisible(color(value, "cyan"), 10)}${padVisible(label, 16)}${detail}`;
}

function resumeHeaderRows() {
  return [
    `${color("MAXWELL MOHAMMADI", "cyan")} ${ansi.dim}// ${portfolio.title}${ansi.reset}`,
    `${pad("base", 12)}${portfolio.location}`,
    `${pad("email", 12)}${portfolio.links.email.replace("mailto:", "")}`,
    `${pad("resume", 12)}${portfolio.links.resume}`,
  ];
}

function resumeSnapshotOutput() {
  return [
    terminalPanel("resume", [
      ...resumeHeaderRows(),
      "",
      `${pad("current", 12)}Aptos Labs | Sep 2025 -> Present`,
      ...pretextWrap(
        "Shipping LLM MCP servers, Decibel trading bots, high-throughput Move contracts, and pitch-ready Aptos demos for prediction markets, Whop-style finance, and agent workflows.",
        64,
      ),
      "",
      metric("throughput", "10k TPS", "prediction market Move contract"),
      metric("agent infra", "MCP", "Decibel + Shelby protocol tooling"),
      metric("trading", "bots", "PineScript to onchain strategies"),
      metric("security", "EY", "custody audits + incident response"),
    ]),
    "",
    terminalPanel("resume commands", [
      commandRow("resume work", "role history with key achievements"),
      commandRow("resume projects", "portfolio projects with concrete URLs"),
      commandRow("proof", "fast proof board of demos and repos"),
      commandRow("timeline", "dates and career path"),
      commandRow("open resume", "open the PDF"),
    ]),
  ].join(newline);
}

function resumeWorkOutput() {
  return terminalPanel("work history", [
    `${color("Aptos Labs", "yellow")} | Software Engineer | September 2025 -> Present`,
    "Ships LLM MCP servers for Decibel Trade and Shelby Protocol.",
    "Built Decibel bots that convert TradingView PineScript into onchain smart contract trading strategies.",
    "Built and optimized a prediction market Move contract with Aptos engineers until benchmark throughput reached 10k TPS.",
    "Built Polymarket and Whop demos for partner pitches and product feedback conversations.",
    "",
    `${color("Ernst & Young, EY Blockchain", "yellow")} | Blockchain Security Consultant | August 2022 -> September 2025`,
    "Audited enterprise crypto custody infrastructure alongside Trail of Bits.",
    "Led crypto incident response investigations with TRM Labs.",
    "Authored stablecoin and protocol risk research for EY Blockchain clients.",
    "Key achievement: developed cross-chain expertise across EVM, Move, Aptos, Sui, and emerging platforms.",
    "",
    `${color("Ernst & Young", "yellow")} | Forensic Data Analyst Intern | June 2021 -> August 2021`,
    "Built anomaly detection for forensic financial analysis and researched Ethereum, Celo, Solidity, EVM, and DeFi protocols.",
    "",
    `${color("Sydereal", "yellow")} | Software Engineering Intern | December 2020 -> June 2021`,
    "Migrated satellite telemetry from SQLite to InfluxDB and implemented spacecraft anomaly detection, saving about $150K.",
    "",
    `${color("Proximai AI", "yellow")} | AI Research Intern | April 2020 -> May 2021`,
    "Prepared NASA NIAC proposals and contributed to RaDAR, a spatial temporal framework for military aircraft GO/NO GO decisions.",
  ]);
}

function projectDetailRows() {
  return portfolio.projects.flatMap((project, index) => [
    `${color(`${index + 1}. ${project.name}`, "yellow")}`,
    `${pad("stack", 10)}${project.stack}`,
    ...pretextWrap(project.summary, 62).map((line) => `${pad("ship", 10)}${line}`),
    project.link ? `${pad("url", 10)}${project.link}` : "",
    "",
  ]);
}

function resumeProjectsOutput() {
  return terminalPanel("selected projects", projectDetailRows().filter(Boolean));
}

function proofOutput() {
  return terminalPanel("proof board", [
    "Live demos and repository evidence:",
    "",
    ...proofLinks.flatMap((item, index) => [
      `${color(`${index + 1}. ${item.label}`, "yellow")}`,
      `${pad("url", 9)}${item.url}`,
      ...pretextWrap(item.detail, 60).map((line) => `${pad("does", 9)}${line}`),
      "",
    ]),
    "Tip: use open github, open linkedin, or open resume for the direct links.",
  ]);
}

function reposOutput() {
  return terminalPanel("repo deck", [
    ...proofLinks.flatMap((item) => [`${padVisible(color(item.label, "yellow"), 24)}${item.url}`]),
    "",
    "Some partner-pitch repos are private or organization-scoped, but the terminal still shows the exact project trail.",
  ]);
}

function timelineOutput() {
  return terminalPanel("timeline", [
    `${padVisible(color("2025 -> now", "cyan"), 16)}Aptos Labs | Software Engineer`,
    "                LLM MCP servers, Decibel bots, prediction market Move contract, Whop and Polymarket demos.",
    `${padVisible(color("2022 -> 2025", "cyan"), 16)}EY Blockchain | Blockchain Security Consultant`,
    "                Custody audits, Trail of Bits collaboration, TRM Labs incident response, cross-chain protocol research.",
    `${padVisible(color("2021", "cyan"), 16)}Ernst & Young | Forensic Data Analyst Intern`,
    "                Anomaly detection, Ethereum and Celo protocol research, Solidity and EVM product research.",
    `${padVisible(color("2020 -> 2021", "cyan"), 16)}Sydereal | Software Engineering Intern`,
    "                Satellite telemetry migration and neural network anomaly detection for spacecraft monitoring.",
    `${padVisible(color("2020 -> 2021", "cyan"), 16)}Proximai AI | AI Research Intern`,
    "                NASA NIAC proposals and RaDAR research for aircraft GO/NO GO decision systems.",
  ]);
}

function nowOutput() {
  return terminalPanel("now", [
    `${color("Aptos Labs", "yellow")} in Palo Alto`,
    "",
    "Current work centers on agent-facing protocol infrastructure, onchain trading systems, and high-throughput Aptos demos that founders and partner teams can actually touch.",
    "",
    commandRow("proof", "show demos and repo evidence"),
    commandRow("resume work", "show role history"),
    commandRow("cube", "open the interactive side quest"),
  ]);
}

function resumeOutput(args: string[] = []) {
  const mode = args[0]?.toLowerCase() ?? "snapshot";

  if (mode === "work" || mode === "experience") return resumeWorkOutput();
  if (mode === "projects" || mode === "project") return resumeProjectsOutput();
  if (mode === "links" || mode === "proof") return proofOutput();
  if (mode === "repos" || mode === "repo") return reposOutput();
  if (mode === "timeline") return timelineOutput();
  if (mode === "pdf" || mode === "download") {
    return terminalPanel("resume pdf", [
      `${pad("path", 10)}${portfolio.links.resume}`,
      `${pad("command", 10)}open resume`,
      "",
      "The terminal view is optimized for scanning; the PDF is the print-ready version.",
    ]);
  }
  if (mode === "full") {
    return [resumeSnapshotOutput(), "", resumeWorkOutput(), "", resumeProjectsOutput()].join(newline);
  }

  return resumeSnapshotOutput();
}

function signatureOutput() {
  return [
    `${color("signature", "yellow")}: drawing the handwritten mark`,
    `${ansi.dim}Reserved below so the ink never sits on top of terminal text.${ansi.reset}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ].join(newline);
}

function statusOutput(theme: TerminalTheme, hasEnteredTerminal: boolean, cubeMode: CubeMode) {
  return [
    headline("system"),
    `${pad("renderer")}wterm/dom`,
    `${pad("theme")}${theme}`,
    `${pad("mode")}interactive portfolio`,
    `${pad("idle")}${hasEnteredTerminal ? "fire dismissed" : "fire waiting"}`,
    `${pad("cube")}${cubeMode}`,
    `${pad("pretext")}terminal copy layout + suggestions`,
    `${pad("signal")}available for sharp product work`,
  ].join(newline);
}

function neofetchOutput(theme: TerminalTheme, cubeMode: CubeMode) {
  return [
    `${ansi.cyan}+----------------------+${ansi.reset}`,
    `${ansi.cyan}|${ansi.reset}  PORTFOLIO RUNTIME  ${ansi.cyan}|${ansi.reset}`,
    `${ansi.cyan}+----------------------+${ansi.reset}`,
    `${pad("name", 7)}${color(portfolio.name, "cyan")}`,
    `${pad("role", 7)}${portfolio.title}`,
    `${pad("base", 7)}${portfolio.location}`,
    `${pad("theme", 7)}${theme}`,
    `${pad("focus", 7)}${portfolio.focus[0]}`,
    `${pad("core", 7)}wterm/react`,
    `${pad("cube", 7)}${cubeMode}`,
    `${pad("next", 7)}hint`,
  ].join(newline);
}

function fileOutput(target: string) {
  if (target === "about.md") return aboutOutput();
  if (target === "contact.txt") return contactOutput();
  if (target === "skills.json") return skillsOutput();
  if (target === "experience.log") return experienceOutput();
  if (target === "proof.links") return proofOutput();
  if (target === "timeline.log") return timelineOutput();
  if (target === "resume.txt") return resumeOutput(["full"]);
  return `${color("cat", "yellow")}: ${target || "missing file"}`;
}

function notFoundOutput(command: string) {
  const suggestion = suggestCommand(command);
  return terminalPanel("not found", [
    `${color("command not found", "red")}: ${command}`,
    "",
    suggestion
      ? `Did you mean ${color(suggestion, "green")}? Type it, or press Tab after the first few letters.`
      : `Type ${color("help", "green")} for the deck or ${color("guide", "green")} for the guided route.`,
  ]);
}

async function simulateHumanTyping(text: string, wpm = 138) {
  const { MarkovTyper } = await import("@etareduction/humantypingts");
  const typer = new MarkovTyper(text, wpm);
  const [, history] = typer.run();
  return history.filter((event) => !event[1].startsWith("INIT")) as HistoryEvent[];
}

function diffTypedText(previous: string, next: string) {
  let shared = 0;
  while (shared < previous.length && shared < next.length && previous[shared] === next[shared]) {
    shared += 1;
  }

  const backspaces = previous.length - shared;
  const added = next.slice(shared);
  return `${"\b \b".repeat(backspaces)}${added.replace(/\n/g, newline)}`;
}

function openExternal(target: string) {
  const key = target.toLowerCase();
  if (key === "github") return portfolio.links.github;
  if (key === "linkedin") return portfolio.links.linkedin;
  if (key === "resume") return portfolio.links.resume;
  return null;
}

function seededNoise(value: number) {
  const x = Math.sin(value * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const bonfireVertexShader = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const bonfireFragmentShader = `
precision highp float;

uniform vec3 iResolution;
uniform float iTime;

mat2 rot(float a) {
  return mat2(cos(a), cos(a + 33.0), cos(a + 11.0), cos(a));
}

vec4 tanh4(vec4 x) {
  vec4 e = exp(-2.0 * x);
  return (1.0 - e) / (1.0 + e);
}

void mainImage(out vec4 O, vec2 P) {
    float i = 0.0;
    float t = 0.0;
    float a = 0.0;
    float n = 0.0;
    float w = 0.0;
    float o = 0.0;
    float d = 1.0;
    float logGlow = 0.0;

    vec3 R = iResolution;
    vec3 p = vec3(0.0);
    vec3 q = vec3(0.0);
    vec3 k = vec3(0.0);

    for (int march = 0; march < 50; march++) {
      if (d <= 0.001) break;
      i += 1.0;

      k = normalize(vec3(P + P, R.y) - R) * t;
      k.y += 6.0;
      d = k.y;
      k.z -= 15.0;
      w = 0.0025;
      a = 0.0;
      n = 0.96 * length(k.xz) + 0.27 * d - 5.34;

      for (int fold = 0; fold < 9; fold++) {
        a += 1.0;
        p = k;
        p.zx = p.zx * rot(a * 2.4);
        q = p;
        q.y -= a * iTime;
        n += abs(dot(sin(q * 0.7 / w), q - q + w));
        p.z -= 5.0;
        p.zy = p.zy * rot(atan(a * 0.18));
        float wood = max(abs(p.z + 5.0) - 5.0, max(abs(p.x) * 0.9 + p.y * 0.5, -p.y) - 0.3);
        float lowerBonfire = smoothstep(-2.3, 0.7, k.y) * (1.0 - smoothstep(3.0, 5.4, k.y));
        float centered = 1.0 - smoothstep(3.4, 6.2, length(k.xz * vec2(0.82, 0.52)));
        logGlow = max(logGlow, (1.0 - smoothstep(0.0, 0.13, abs(wood))) * lowerBonfire * centered);
        d = min(d, wood);
        w += w;
      }

      if (d > n) {
        d = abs(n) * 0.4 + 0.05;
        o += 1.0 / d;
      } else {
        o += exp(3.0 - length(k) * 0.6);
      }
      t += d * 0.5;
    }

    O = tanh4(o * vec4(9.0, 3.0, 1.0, 0.0) / 500.0);
    float flameBrightness = max(max(O.r, O.g), O.b);
    float flameOcclusion = 1.0 - smoothstep(0.38, 0.86, flameBrightness);
    O.rgb = mix(O.rgb, vec3(0.08, 1.0, 0.22), clamp(logGlow * flameOcclusion * 0.9, 0.0, 0.52));
}

void main() {
  vec4 color;
  vec2 framedCoord = (gl_FragCoord.xy - iResolution.xy * 0.5) * 0.96 + iResolution.xy * 0.5;
  mainImage(color, framedCoord);
  gl_FragColor = vec4(color.rgb, 1.0);
}
`;

type BonfireShader = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  resolutionLocation: WebGLUniformLocation | null;
  timeLocation: WebGLUniformLocation | null;
  buffer: WebGLBuffer | null;
  pixels: Uint8Array;
  resize: (width: number, height: number) => void;
  render: (time: number) => void;
  dispose: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const nextValue = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return nextValue * nextValue * (3 - 2 * nextValue);
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn("bonfire shader compile failed", gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function createBonfireShader(width: number, height: number): BonfireShader | null {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: true,
    stencil: false,
  });
  if (!gl) return null;

  const vertex = compileShader(gl, gl.VERTEX_SHADER, bonfireVertexShader);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, bonfireFragmentShader);
  if (!vertex || !fragment) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("bonfire shader link failed", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const shader: BonfireShader = {
    canvas,
    gl,
    program,
    resolutionLocation: gl.getUniformLocation(program, "iResolution"),
    timeLocation: gl.getUniformLocation(program, "iTime"),
    buffer,
    pixels: new Uint8Array(width * height * 4),
    resize(nextWidth: number, nextHeight: number) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      shader.pixels = new Uint8Array(nextWidth * nextHeight * 4);
      gl.viewport(0, 0, nextWidth, nextHeight);
    },
    render(time: number) {
      gl.useProgram(program);
      gl.uniform3f(shader.resolutionLocation, canvas.width, canvas.height, 1);
      gl.uniform1f(shader.timeLocation, time);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, shader.pixels);
    },
    dispose() {
      gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
    },
  };

  shader.resize(width, height);
  return shader;
}

function fireColor(brightness: number, verticalPosition: number) {
  if (brightness > 0.72) return `rgba(255, 238, 190, ${clamp(brightness, 0.36, 0.97)})`;
  if (brightness > 0.38) return `rgba(255, 154, 58, ${clamp(brightness * 0.98, 0.22, 0.88)})`;
  const offset = verticalPosition < 0.34 ? 78 : 44;
  return `rgba(${222 - offset}, ${96 - offset * 0.28}, 42, ${clamp(brightness * 0.74, 0.11, 0.56)})`;
}

function sampleBonfire(shader: BonfireShader, x: number, y: number) {
  const pixelX = clamp(Math.floor(x * shader.canvas.width), 0, shader.canvas.width - 1);
  const pixelY = clamp(Math.floor((1 - y) * shader.canvas.height), 0, shader.canvas.height - 1);
  const index = (pixelY * shader.canvas.width + pixelX) * 4;
  const red = shader.pixels[index] ?? 0;
  const green = shader.pixels[index + 1] ?? 0;
  const blue = shader.pixels[index + 2] ?? 0;

  return {
    brightness: clamp((red * 0.72 + green * 0.22 + blue * 0.06) / 255, 0, 1),
    log: green > 80 && green > red * 1.45 && green > blue * 1.45,
  };
}

function sampleFallbackBonfire(x: number, y: number, time: number) {
  const verticalMask = smoothstep(0.98, 0.72, y) * smoothstep(0.02, 0.16, y);
  const rise = 1 - y;
  const sway = Math.sin(y * 12 + time * 1.4) * 0.035 * (0.35 + rise);
  const curl = Math.sin(y * 24 - time * 2.2 + Math.sin(x * 11) * 0.8) * 0.024;
  const center = 0.5 + sway + curl;
  const baseWidth = 0.055 + y ** 1.55 * 0.58;
  const dx = Math.abs(x - center);
  const body = 1 - smoothstep(baseWidth * 0.36, baseWidth, dx);
  const core = 1 - smoothstep(baseWidth * 0.12, baseWidth * 0.42, dx);
  const sparks =
    seededNoise(Math.floor(x * 84) * 17 + Math.floor(y * 58) * 43 + Math.floor(time * 10)) * 0.24;
  const flicker = 0.78 + Math.sin(time * 5.1 + y * 21 + x * 9) * 0.14 + sparks;
  const brightness = clamp((body * 0.66 + core * 0.38) * verticalMask * flicker, 0, 1);

  return {
    brightness,
    log: false,
  };
}

type LogueBackdropProps = {
  className?: string;
  variant?: "field" | "fire";
};

function LogueBackdrop({ className = "logue-backdrop-canvas", variant = "field" }: LogueBackdropProps) {
  const cleanupRef = useRef<(() => void) | null>(null);
  const isFireLayer = variant === "fire";

  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame: number | null = null;
    let lastFrame = 0;
    let width = 0;
    let height = 0;
    let columns = 0;
    let rows = 0;
    let cellWidth = 10;
    let cellHeight = 14;
    let fontSize = 10;
    let fireSize = 380;
    let fireColumns = 48;
    let fireRows = 42;
    let fireCellWidth = 8;
    let fireCellHeight = 10;
    let fireFontSize = 10;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let pointerEnergy = 0;
    let visible = !document.hidden;
    const fieldChars = "MAX";
    const fireChars = "FIRE";
    const bonfireShader = isFireLayer ? createBonfireShader(640, 640) : null;
    const particles = Array.from({ length: 260 }, (_, index) => ({
      x: seededNoise(index + 10),
      y: seededNoise(index + 50),
      vx: (seededNoise(index + 90) - 0.5) * 0.00095,
      vy: (seededNoise(index + 140) - 0.5) * 0.00095,
      seed: seededNoise(index + 220),
    }));

    const resize = () => {
      const ratio = clamp(window.devicePixelRatio || 1, 1, 2);
      width = Math.max(1, canvas.clientWidth);
      height = Math.max(1, canvas.clientHeight);
      columns = Math.max(76, Math.round(width / 7.4));
      rows = Math.max(54, Math.round(height / 10.8));
      cellWidth = width / columns;
      cellHeight = height / rows;
      fontSize = clamp(cellHeight * 0.95, 6.8, 12.5);
      fireSize = isFireLayer
        ? clamp(Math.min(width * 0.46, height * 0.66), 250, 430)
        : clamp(Math.min(width * 0.5, height * 0.74), 290, 560);
      fireCellWidth = clamp(fireSize / 54, 6.6, 10.2);
      fireCellHeight = fireCellWidth * 1.22;
      fireFontSize = clamp(fireCellHeight * 1.08, 8.2, 13);
      fireColumns = Math.ceil(fireSize / fireCellWidth);
      fireRows = Math.ceil(fireSize / fireCellHeight);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(performance.now(), true);
    };

    const draw = (time: number, force = false) => {
      if (!force && time - lastFrame < 1000 / 30) return;
      lastFrame = time;
      const t = time * 0.001;

      context.clearRect(0, 0, width, height);
      if (!isFireLayer) {
        context.fillStyle = "#050709";
        context.fillRect(0, 0, width, height);

        const stageWash = context.createRadialGradient(
          width * 0.5,
          height * 0.55,
          0,
          width * 0.5,
          height * 0.55,
          Math.max(width, height) * 0.5,
        );
        stageWash.addColorStop(0, "rgba(75, 135, 160, 0.055)");
        stageWash.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = stageWash;
        context.fillRect(0, 0, width, height);
      }

      context.font = `500 ${fontSize}px "Fira Code Local", monospace`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.globalCompositeOperation = "lighter";

      if (!isFireLayer) {
        for (const particle of particles) {
          particle.x = (particle.x + particle.vx + Math.sin(t * 0.34 + particle.seed * 6.28) * 0.00016 + 1) % 1;
          particle.y = (particle.y + particle.vy + Math.cos(t * 0.29 + particle.seed * 6.28) * 0.00016 + 1) % 1;
        }

        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const x = (column + 0.5) * cellWidth;
            const y = (row + 0.5) * cellHeight;
            const nx = x / width;
            const ny = y / height;
            const drift = Math.sin(nx * 18 + t * 0.72) + Math.cos(ny * 15 - t * 0.58);
            const wave = Math.sin((nx + ny) * 28 - t * 1.1);
            let alpha = 0.105 + Math.max(0, drift * 0.04) + Math.max(0, wave * 0.035);

            for (let index = 0; index < 4; index += 1) {
              const particle = particles[(row * 13 + column * 7 + index * 19) % particles.length];
              const dx = nx - particle.x;
              const dy = ny - particle.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              alpha += Math.max(0, 0.095 - distance) * 0.72;
            }

            const pdx = nx - pointerX;
            const pdy = ny - pointerY;
            const pointerDistance = Math.sqrt(pdx * pdx + pdy * pdy);
            alpha += Math.max(0, 0.14 - pointerDistance) * pointerEnergy * 0.75;

            const distanceFromCenter = Math.sqrt((nx - 0.5) ** 2 + ((ny - 0.5) * 0.94) ** 2);
            alpha *= 0.52 + clamp(distanceFromCenter * 1.38, 0, 0.62);

            const charIndex =
              (row * 11 +
                column * 5 +
                Math.floor(t * 6) +
                Math.floor(seededNoise(row * 81 + column * 29 + Math.floor(t * 8)) * 4)) %
              fieldChars.length;
            context.fillStyle = `rgba(145, 198, 218, ${Math.min(0.48, alpha).toFixed(3)})`;
            context.fillText(fieldChars[charIndex], x, y);
          }
        }
      }

      if (isFireLayer) {
        const compactFireLayout = width < 520;
        const fireCenterX = width * (compactFireLayout ? 0.55 : 0.56) + (pointerX - 0.5) * 18;
        const fireCenterY = height * (compactFireLayout ? 0.68 : 0.57) + (pointerY - 0.5) * 12;
        const fireLeft = fireCenterX - fireSize / 2;
        const fireTop = fireCenterY - fireSize / 2;

        bonfireShader?.render(t);

        const fireGlow = context.createRadialGradient(
          fireCenterX,
          fireTop + fireSize * 0.72,
          0,
          fireCenterX,
          fireTop + fireSize * 0.66,
          fireSize * 0.5,
        );
        fireGlow.addColorStop(0, "rgba(251, 146, 60, 0.26)");
        fireGlow.addColorStop(0.36, "rgba(185, 75, 35, 0.14)");
        fireGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = fireGlow;
        context.fillRect(fireLeft - fireSize * 0.14, fireTop - fireSize * 0.14, fireSize * 1.28, fireSize * 1.28);

        context.textAlign = "center";
        context.textBaseline = "alphabetic";
        for (let row = 0; row < fireRows; row += 1) {
          const yPosition = (row + 0.5) / fireRows;
          for (let column = 0; column < fireColumns; column += 1) {
            const xPosition = (column + 0.5) / fireColumns;
            const sample = bonfireShader
              ? sampleBonfire(bonfireShader, xPosition, yPosition)
              : sampleFallbackBonfire(xPosition, yPosition, t);
            if (sample.brightness < 0.105) continue;
            const variants = sample.brightness > 0.68 ? "FFEE" : `${fireChars}IR`;
            const char =
              variants[
                Math.floor(
                  seededNoise(column * 7 + row * 19 + Math.floor(t * 18) + Math.floor(sample.brightness * 17)) *
                    variants.length,
                )
              ];
            const brightness = clamp(sample.brightness ** 0.68 * 1.35, 0, 1);
            const flicker = 0.86 + ((column * 13 + row * 19 + Math.floor(t * 18)) % 11) * 0.024;
            context.font = `${sample.brightness > 0.55 ? 700 : 500} ${fireFontSize}px "Fira Code Local", monospace`;
            context.fillStyle = sample.log
              ? `rgba(5, 5, 4, ${clamp(0.48 + brightness * 0.42, 0.56, 0.92)})`
              : fireColor(brightness * flicker, yPosition);
            context.fillText(
              char ?? "F",
              fireLeft + column * fireCellWidth + fireCellWidth * 0.5,
              fireTop + row * fireCellHeight + fireCellHeight * 0.78,
            );
          }
        }
      }

      context.globalCompositeOperation = "source-over";

      if (!isFireLayer) {
        const vignette = context.createRadialGradient(
          width * 0.5,
          height * 0.5,
          Math.min(width, height) * 0.28,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.72,
        );
        vignette.addColorStop(0, "rgba(3, 4, 8, 0)");
        vignette.addColorStop(1, "rgba(3, 4, 8, 0.46)");
        context.fillStyle = vignette;
        context.fillRect(0, 0, width, height);
      }

      pointerEnergy *= 0.9;
    };

    const loop = (time: number) => {
      if (visible) draw(time);
      animationFrame = window.requestAnimationFrame(loop);
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerX = event.clientX / Math.max(1, window.innerWidth);
      pointerY = event.clientY / Math.max(1, window.innerHeight);
      pointerEnergy = Math.max(pointerEnergy, 0.9);
    };

    const handleVisibilityChange = () => {
      visible = !document.hidden;
      if (visible) draw(performance.now(), true);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    resize();
    animationFrame = window.requestAnimationFrame(loop);

    cleanupRef.current = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      bonfireShader?.dispose();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isFireLayer]);

  return <canvas className={className} ref={canvasRef} aria-hidden="true" />;
}

function loadSignatureInkMap() {
  if (signatureInkMapPromise) return signatureInkMapPromise;

  signatureInkMapPromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = signatureViewBox.width;
      canvas.height = signatureViewBox.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        reject(new Error("Unable to sample signature ink."));
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const hasInk = new Uint8Array(canvas.width);
      const centerYByX = new Float32Array(canvas.width);
      centerYByX.fill(Number.NaN);

      let minX = canvas.width;
      let maxX = 0;

      for (let x = 0; x < canvas.width; x += 1) {
        let minY = canvas.height;
        let maxY = -1;
        let weightedY = 0;
        let alphaWeight = 0;

        for (let y = 0; y < canvas.height; y += 1) {
          const alpha = pixels[(y * canvas.width + x) * 4 + 3] ?? 0;
          if (alpha <= 24) continue;
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          weightedY += y * alpha;
          alphaWeight += alpha;
        }

        if (maxY < 0) continue;
        hasInk[x] = 1;
        centerYByX[x] = alphaWeight > 0 ? weightedY / alphaWeight : (minY + maxY) / 2;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }

      if (minX >= canvas.width) {
        reject(new Error("Signature image has no visible ink."));
        return;
      }

      const previousInkByX = new Int32Array(canvas.width);
      const nextInkByX = new Int32Array(canvas.width);
      previousInkByX.fill(-1);
      nextInkByX.fill(-1);

      let previousInk = -1;
      for (let x = 0; x < canvas.width; x += 1) {
        if (hasInk[x]) previousInk = x;
        previousInkByX[x] = previousInk;
      }

      let nextInk = -1;
      for (let x = canvas.width - 1; x >= 0; x -= 1) {
        if (hasInk[x]) nextInk = x;
        nextInkByX[x] = nextInk;
      }

      resolve({
        width: canvas.width,
        height: canvas.height,
        minX,
        maxX,
        hasInk,
        centerYByX,
        previousInkByX,
        nextInkByX,
      });
    };
    image.onerror = () => reject(new Error("Unable to load signature image."));
    image.src = signatureAssetPath;
  });

  return signatureInkMapPromise;
}

function findInkColumn(map: SignatureInkMap, targetX: number) {
  const startX = Math.round(clamp(targetX, map.minX, map.maxX));
  for (let x = startX; x >= map.minX; x -= 1) {
    if (map.hasInk[x]) return x;
  }
  for (let x = startX; x <= map.maxX; x += 1) {
    if (map.hasInk[x]) return x;
  }
  return map.minX;
}

function getSignatureSourcePoint(map: SignatureInkMap, targetX: number) {
  const x = clamp(targetX, map.minX, map.maxX);
  const roundedX = Math.round(x);

  if (map.hasInk[roundedX]) {
    return {
      x: roundedX,
      y: map.centerYByX[roundedX] || 0,
    };
  }

  const previousX = map.previousInkByX[roundedX] ?? -1;
  const nextX = map.nextInkByX[roundedX] ?? -1;

  if (previousX >= 0 && nextX >= 0 && nextX !== previousX) {
    const gapProgress = smoothstep(previousX, nextX, x);
    const previousY = map.centerYByX[previousX] || 0;
    const nextY = map.centerYByX[nextX] || previousY;
    const gapWidth = nextX - previousX;
    const lift = Math.min(40, Math.max(8, gapWidth * 0.075)) * Math.sin(gapProgress * Math.PI);

    return {
      x,
      y: lerp(previousY, nextY, gapProgress) - lift,
    };
  }

  const fallbackX = previousX >= 0 ? previousX : nextX >= 0 ? nextX : findInkColumn(map, x);
  return {
    x: fallbackX,
    y: map.centerYByX[fallbackX] || 0,
  };
}

function signatureProgress(value: number) {
  const t = clamp(value, 0, 1);
  return 0.5 - Math.cos(t * Math.PI) / 2;
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function lerpAngle(start: number, end: number, amount: number) {
  const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start));
  return start + delta * amount;
}

function smoothingFactor(deltaSeconds: number, speed: number) {
  return 1 - Math.exp(-deltaSeconds * speed);
}

function getSignaturePenPoint(
  map: SignatureInkMap,
  stageRect: DOMRect,
  imageRect: DOMRect,
  currentX: number,
): SignaturePenPoint {
  const source = getSignatureSourcePoint(map, currentX);
  const previous = getSignatureSourcePoint(map, currentX - 24);
  const next = getSignatureSourcePoint(map, currentX + 24);
  const scaleX = imageRect.width / map.width;
  const scaleY = imageRect.height / map.height;
  const x = imageRect.left - stageRect.left + source.x * scaleX;
  const y = imageRect.top - stageRect.top + source.y * scaleY;
  const angle = clamp(
    Math.atan2((next.y - previous.y) * scaleY, (next.x - previous.x) * scaleX),
    -0.5,
    0.5,
  );

  return { x, y, angle };
}

function SignatureDrawLayer({ runId }: { runId: number }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const penRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (runId === 0) return;

    let animationFrame = 0;
    let active = true;
    let smoothedPoint: SignaturePenPoint | null = null;
    let lastTickTime = performance.now();
    let elapsedDrawMs = 0;
    let stageRect: DOMRect | null = null;
    let imageRect: DOMRect | null = null;
    let frameIndex = 0;
    const stage = stageRef.current;
    const pen = penRef.current;

    stage?.style.setProperty("--signature-reveal", "0%");
    if (pen) {
      pen.classList.remove("is-active", "is-complete");
      pen.style.transform = "translate3d(0, 0, 0) rotate(0rad)";
    }

    const tick = (map: SignatureInkMap, now: number) => {
      const stage = stageRef.current;
      const image = imageRef.current;
      const pen = penRef.current;
      if (!active || !stage || !image || !pen) return;

      const realDeltaSeconds = clamp((now - lastTickTime) / 1000, 1 / 120, 1 / 20);
      const animationDeltaSeconds = Math.min(realDeltaSeconds, 1 / 60);
      elapsedDrawMs += animationDeltaSeconds * 1000;
      const progress = clamp(elapsedDrawMs / signatureDrawDurationMs, 0, 1);
      const easedProgress = signatureProgress(progress);
      const currentX = map.minX + (map.maxX - map.minX) * easedProgress;
      if (!stageRect || !imageRect || frameIndex % 12 === 0) {
        stageRect = stage.getBoundingClientRect();
        imageRect = image.getBoundingClientRect();
      }
      frameIndex += 1;
      const revealX = progress >= 1 ? map.width : currentX;
      const targetPoint = getSignaturePenPoint(map, stageRect, imageRect, currentX);
      const horizontalFollow = smoothingFactor(animationDeltaSeconds, 36);
      const verticalFollow = smoothingFactor(animationDeltaSeconds, 18);
      const angleFollow = smoothingFactor(animationDeltaSeconds, 18);

      lastTickTime = now;
      smoothedPoint = smoothedPoint
        ? {
            x: lerp(smoothedPoint.x, targetPoint.x, horizontalFollow),
            y: lerp(smoothedPoint.y, targetPoint.y, verticalFollow),
            angle: lerpAngle(smoothedPoint.angle, targetPoint.angle, angleFollow),
          }
        : targetPoint;

      stage.style.setProperty("--signature-reveal", `${(revealX / map.width) * 100}%`);
      pen.style.transform = `translate3d(${smoothedPoint.x}px, ${smoothedPoint.y}px, 0) rotate(${smoothedPoint.angle}rad)`;
      pen.classList.add("is-active");

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame((nextNow) => tick(map, nextNow));
      } else {
        pen.classList.add("is-complete");
      }
    };

    loadSignatureInkMap()
      .then((map) => {
        if (!active) return;
        animationFrame = window.requestAnimationFrame((now) => tick(map, now));
      })
      .catch(() => {
        if (!active) return;
        stageRef.current?.style.setProperty("--signature-reveal", "100%");
        penRef.current?.classList.add("is-complete");
      });

    return () => {
      active = false;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [runId]);

  if (runId === 0) return null;

  return (
    <div className="signature-draw-layer" aria-hidden="true" key={runId}>
      <div
        className="signature-handwriting-stage"
        ref={stageRef}
        style={{ "--signature-reveal": "0%" } as CSSProperties}
      >
        <img
          className="signature-final-image"
          ref={imageRef}
          src={signatureAssetPath}
          alt=""
          draggable={false}
        />
        <div className="signature-pen-anchor" ref={penRef}>
          <img className="signature-quill-image" src={signatureQuillAssetPath} alt="" draggable={false} />
        </div>
      </div>
    </div>
  );
}

function App() {
  const { ref, write: terminalWrite, focus } = useTerminal();
  const [terminalTheme, setTerminalTheme] = useState<TerminalTheme>("logue");
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [hasEnteredTerminal, setHasEnteredTerminal] = useState(false);
  const prompt = useMemo(
    () => `${ansi.green}${portfolio.handle}${ansi.reset}${ansi.dim}@${ansi.reset}${ansi.cyan}portfolio${ansi.reset}:${ansi.blue}~${ansi.reset}$ `,
    [],
  );
  const currentLineRef = useRef("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number | null>(null);
  const visitedCommandsRef = useRef<Set<string>>(new Set());
  const hasEnteredTerminalRef = useRef(false);
  const [signatureRunId, setSignatureRunId] = useState(0);
  const [cubeVisible, setCubeVisible] = useState(false);
  const [cubeState, setCubeState] = useState<RubiksCubeState>(() => createSolvedCube());
  const [cubeMode, setCubeMode] = useState<CubeMode>("ready");
  const [cubeActiveMove, setCubeActiveMove] = useState<string | null>(null);
  const [cubeMoveTick, setCubeMoveTick] = useState(0);
  const [cubeLastScramble, setCubeLastScramble] = useState<string[]>([]);
  const [cubeLastSolution, setCubeLastSolution] = useState<string[]>([]);
  const [setupVisible, setSetupVisible] = useState(false);
  const cubeStateRef = useRef<RubiksCubeState>(cubeState);
  const cubeHistoryRef = useRef<string[]>([]);
  const cubeVisibleRef = useRef(cubeVisible);
  const cubeTimersRef = useRef<number[]>([]);
  const typingTimersRef = useRef<number[]>([]);
  const terminalScrollTimerRef = useRef<number | null>(null);
  const terminalScrollFrameRef = useRef<number | null>(null);
  const bootRunRef = useRef(0);

  useEffect(() => {
    void loadSignatureInkMap().catch(() => undefined);
  }, []);

  useEffect(() => {
    cubeStateRef.current = cubeState;
  }, [cubeState]);

  useEffect(() => {
    cubeVisibleRef.current = cubeVisible;
  }, [cubeVisible]);

  const clearCubeTimers = useCallback(() => {
    for (const timer of cubeTimersRef.current) window.clearTimeout(timer);
    cubeTimersRef.current = [];
  }, []);

  useEffect(() => clearCubeTimers, [clearCubeTimers]);

  const clearTypingTimers = useCallback(() => {
    for (const timer of typingTimersRef.current) window.clearTimeout(timer);
    typingTimersRef.current = [];
  }, []);

  useEffect(() => clearTypingTimers, [clearTypingTimers]);

  useEffect(
    () => () => {
      if (terminalScrollTimerRef.current !== null) window.clearTimeout(terminalScrollTimerRef.current);
      if (terminalScrollFrameRef.current !== null) window.cancelAnimationFrame(terminalScrollFrameRef.current);
    },
    [],
  );

  const animateCubeMoves = useCallback(
    (
      moves: readonly string[],
      finalMode: CubeMode,
      options: { activeMode?: CubeMode; startState?: RubiksCubeState; fromSolved?: boolean } = {},
    ) => {
      clearCubeTimers();
      setCubeVisible(true);
      setCubeActiveMove(null);
      setCubeMoveTick((value) => value + 1);

      const startState = options.startState ?? (options.fromSolved ? createSolvedCube() : cubeStateRef.current);
      cubeStateRef.current = startState;
      setCubeState(startState);

      if (moves.length === 0) {
        setCubeMode(finalMode);
        return;
      }

      const turnDuration = 96;
      const stepDelay = turnDuration + 16;
      const startOffset = cubeVisibleRef.current ? 18 : 280;
      let nextState = startState;
      const snapshots = moves.map((move) => {
        nextState = applyCubeMove(nextState, move);
        return { move, state: nextState };
      });

      setCubeMode(options.activeMode ?? "scrambling");
      snapshots.forEach((snapshot, index) => {
        const startTimer = window.setTimeout(() => {
          setCubeActiveMove(snapshot.move);
          setCubeMoveTick((value) => value + 1);
        }, startOffset + index * stepDelay);
        const commitTimer = window.setTimeout(() => {
          cubeStateRef.current = snapshot.state;
          setCubeState(snapshot.state);
          setCubeActiveMove(null);
          setCubeMoveTick((value) => value + 1);
        }, startOffset + index * stepDelay + turnDuration);
        cubeTimersRef.current.push(startTimer, commitTimer);
      });

      const doneTimer = window.setTimeout(() => {
        setCubeActiveMove(null);
        setCubeMode(finalMode);
      }, startOffset + (snapshots.length - 1) * stepDelay + turnDuration + 32);
      cubeTimersRef.current.push(doneTimer);
    },
    [clearCubeTimers],
  );

  const scrollTerminalToBottom = useCallback(() => {
    const element = ref.current?.instance?.element ?? document.querySelector<HTMLElement>(".portfolio-terminal");
    if (!element) return;
    const maxScroll = element.scrollHeight - element.clientHeight;
    if (maxScroll <= 0) {
      element.scrollTop = 0;
      return;
    }

    const rowHeight =
      Number.parseFloat(getComputedStyle(element).getPropertyValue("--term-row-height")) ||
      Number.parseFloat(getComputedStyle(element).lineHeight) ||
      17;
    const target = Math.floor(maxScroll / rowHeight) * rowHeight;
    if (Math.abs(element.scrollTop - target) > 0.5) element.scrollTop = target;
  }, [ref]);

  const scheduleTerminalScroll = useCallback(() => {
    if (terminalScrollTimerRef.current !== null || terminalScrollFrameRef.current !== null) return;

    terminalScrollTimerRef.current = window.setTimeout(() => {
      terminalScrollTimerRef.current = null;
      terminalScrollFrameRef.current = window.requestAnimationFrame(() => {
        terminalScrollFrameRef.current = null;
        scrollTerminalToBottom();
      });
    }, 0);
  }, [scrollTerminalToBottom]);

  const write = useCallback(
    (data: Parameters<typeof terminalWrite>[0]) => {
      terminalWrite(data);
      scheduleTerminalScroll();
    },
    [scheduleTerminalScroll, terminalWrite],
  );

  const writePrompt = useCallback(() => {
    write(prompt);
    focus();
    scheduleTerminalScroll();
  }, [focus, prompt, scheduleTerminalScroll, write]);

  const writeHumanTypedText = useCallback(
    async (text: string) => {
      clearTypingTimers();
      const events = await simulateHumanTyping(text);

      return new Promise<void>((resolve) => {
        let previousText = "";
        let previousEventTime = 0;
        let accumulatedDelay = 0;

        for (const [eventTime, , nextText] of events) {
          const rawDelta = Math.max(0, eventTime - previousEventTime);
          previousEventTime = eventTime;
          accumulatedDelay += clamp(rawDelta * 260, 8, 90);
          const patch = diffTypedText(previousText, nextText);
          previousText = nextText;
          const timer = window.setTimeout(() => write(patch), accumulatedDelay);
          typingTimersRef.current.push(timer);
        }

        const doneTimer = window.setTimeout(() => {
          typingTimersRef.current = [];
          resolve();
        }, accumulatedDelay + 30);
        typingTimersRef.current.push(doneTimer);
      });
    },
    [clearTypingTimers, write],
  );

  const clearInputLine = useCallback(() => {
    write(`\r\x1b[2K${prompt}`);
  }, [prompt, write]);

  const replaceInputLine = useCallback(
    (nextValue: string) => {
      currentLineRef.current = nextValue;
      clearInputLine();
      write(nextValue);
    },
    [clearInputLine, write],
  );

  const markEnteredTerminal = useCallback(() => {
    if (hasEnteredTerminalRef.current) return;
    hasEnteredTerminalRef.current = true;
    setHasEnteredTerminal(true);
  }, []);

  const runCubeCommand = useCallback(
    (args: string[]) => {
      const [rawAction = "on", ...rest] = args;
      const action = rawAction.toLowerCase();

      if (action === "on" || action === "show" || action === "open") {
        setCubeVisible(true);
        return cubeIntroOutput(cubeMode, cubeHistoryRef.current.length > 0);
      }

      if (action === "off" || action === "hide" || action === "close") {
        setCubeVisible(false);
        setCubeActiveMove(null);
        return cubeHiddenOutput();
      }

      if (action === "source") {
        setCubeVisible(true);
        return cubeSourceOutput();
      }

      if (action === "reset") {
        clearCubeTimers();
        const solved = createSolvedCube();
        cubeStateRef.current = solved;
        cubeHistoryRef.current = [];
        setCubeState(solved);
        setCubeLastScramble([]);
        setCubeLastSolution([]);
        setCubeActiveMove(null);
        setCubeMode("solved");
        setCubeVisible(true);
        return cubeResetOutput();
      }

      if (action === "scramble") {
        const requestedLength = Number.parseInt(rest[0] ?? "20", 10);
        const scramble = generateCubeScramble(Number.isFinite(requestedLength) ? requestedLength : 20);
        const solution = invertCubeMoves(scramble);
        cubeHistoryRef.current = scramble;
        setCubeLastScramble(scramble);
        setCubeLastSolution(solution);
        animateCubeMoves(scramble, "scrambled", { activeMode: "scrambling", fromSolved: true });
        return cubeScrambleOutput(scramble, solution);
      }

      if (action === "solve") {
        const manualInput = rest.join(" ");
        if (manualInput) {
          const parsed = parseCubeMoves(manualInput);
          if (!parsed.ok) return cubeErrorOutput(parsed.error);
          const solution = invertCubeMoves(parsed.moves);
          const startState = applyCubeMoves(createSolvedCube(), parsed.moves);
          cubeHistoryRef.current = [];
          setCubeLastScramble(parsed.moves);
          setCubeLastSolution(solution);
          animateCubeMoves(solution, "solved", { activeMode: "solving", startState });
          return cubeSolveOutput(solution);
        }

        const solution = invertCubeMoves(cubeHistoryRef.current);
        cubeHistoryRef.current = [];
        setCubeLastSolution(solution);
        animateCubeMoves(solution, "solved", { activeMode: "solving" });
        return cubeSolveOutput(solution);
      }

      const parsed = parseCubeMoves(args.join(" "));
      if (!parsed.ok) return cubeErrorOutput(parsed.error);
      if (parsed.moves.length === 0) {
        setCubeVisible(true);
        return cubeIntroOutput(cubeMode, cubeHistoryRef.current.length > 0);
      }

      cubeHistoryRef.current = [...cubeHistoryRef.current, ...parsed.moves];
      setCubeLastScramble(cubeHistoryRef.current);
      setCubeLastSolution(invertCubeMoves(cubeHistoryRef.current));
      animateCubeMoves(parsed.moves, "scrambled", { activeMode: "scrambling" });
      return cubeMoveOutput(parsed.moves);
    },
    [animateCubeMoves, clearCubeTimers, cubeMode],
  );

  const runCommand = useCallback(
    async (rawCommand: string) => {
      const command = rawCommand.trim();
      const [name = "", ...args] = command.split(/\s+/);
      const firstArg = args.join(" ");

      if (!command) {
        writePrompt();
        return;
      }

      markEnteredTerminal();
      if (name !== "signature" && name !== "sign") {
        setSignatureRunId(0);
      }
      historyRef.current = [
        ...historyRef.current.filter((entry) => entry !== command),
        command,
      ].slice(-50);
      historyIndexRef.current = null;

      if (availableCommands.includes(name as PortfolioCommand)) {
        visitedCommandsRef.current.add(name);
        if (name === "whoami") visitedCommandsRef.current.add("about");
      }

      if (name === "clear") {
        clearTypingTimers();
        write("\x1b[2J\x1b[H");
        writePrompt();
        return;
      }

      if (name === "theme") {
        const nextTheme = args[0] as TerminalTheme | undefined;
        if (nextTheme === "logue" || nextTheme === "paper" || nextTheme === "midnight") {
          setTerminalTheme(nextTheme);
          write(`${color("theme", "green")} ${nextTheme}${newline}${newline}`);
        } else {
          write(`${color("usage", "yellow")}: theme logue | paper | midnight${newline}${newline}`);
        }
        writePrompt();
        return;
      }

      if (name === "open") {
        const url = openExternal(args[0] ?? "");
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
          write(`${color("opening", "green")} ${url}${newline}${newline}`);
        } else {
          write(`${color("usage", "yellow")}: open github | linkedin | resume${newline}${newline}`);
        }
        writePrompt();
        return;
      }

      if (name === "mail") {
        window.location.href = portfolio.links.email;
        write(`${color("mail", "green")} ${portfolio.links.email}${newline}${newline}`);
        writePrompt();
        return;
      }

      if (name === "signature" || name === "sign") {
        visitedCommandsRef.current.add("signature");
        setSignatureRunId((value) => value + 1);
        write(`${signatureOutput()}${newline}${newline}`);
        writePrompt();
        return;
      }

      if (name === "about" || name === "intro") {
        visitedCommandsRef.current.add("about");
        write(`${typingIntroOutput()}${color("max", "green")}${ansi.dim}@${ansi.reset}${ansi.cyan}portfolio${ansi.reset}:${ansi.blue}~/about${ansi.reset}$ vim about.max.ts${newline}`);
        await writeHumanTypedText(aboutProgramSource());
        const nudge = contextualNudge("about", visitedCommandsRef.current, cubeVisible, cubeHistoryRef.current.length > 0);
        write(`${newline}${newline}${nudge}${newline}${newline}`);
        writePrompt();
        return;
      }

      if (name === "cube") {
        setSetupVisible(false);
        const output = runCubeCommand(args);
        write(`${output}${newline}${newline}`);
        writePrompt();
        return;
      }

      if (name === "setup" || name === "desk") {
        const action = args[0]?.toLowerCase() ?? "show";
        if (action === "hide" || action === "off" || action === "close") {
          setSetupVisible(false);
          write(`${setupHiddenOutput()}${newline}${newline}`);
        } else if (action === "source") {
          setSetupVisible(true);
          setCubeVisible(false);
          write(`${setupSourceOutput()}${newline}${newline}`);
        } else {
          setSetupVisible(true);
          setCubeVisible(false);
          write(`${setupOutput()}${newline}${newline}`);
        }
        writePrompt();
        return;
      }

      const output =
        name === "help" || name === "?"
          ? helpOutput(visitedCommandsRef.current)
          : name === "guide"
            ? guideOutput(visitedCommandsRef.current)
          : name === "hint"
            ? hintOutput(visitedCommandsRef.current, cubeVisible, cubeHistoryRef.current.length > 0)
          : name === "next"
            ? nextOutput(visitedCommandsRef.current)
          : name === "map"
            ? mapOutput(visitedCommandsRef.current)
          : name === "now"
            ? nowOutput()
          : name === "whoami"
            ? aboutOutput()
            : name === "ls"
              ? lsOutput()
              : name === "pwd"
                ? "/home/max/portfolio"
                : name === "cat"
                  ? fileOutput(firstArg)
                  : name === "projects"
                    ? projectsOutput()
                    : name === "experience"
                      ? experienceOutput()
                      : name === "proof"
                        ? proofOutput()
                        : name === "repos"
                          ? reposOutput()
                          : name === "timeline"
                            ? timelineOutput()
                      : name === "skills"
                        ? skillsOutput()
                        : name === "contact"
                          ? contactOutput()
                          : name === "links"
                            ? linksOutput()
                            : name === "resume"
                              ? resumeOutput(args)
                              : name === "status"
                                ? statusOutput(terminalTheme, hasEnteredTerminalRef.current, cubeMode)
                                : name === "neofetch"
                                  ? neofetchOutput(terminalTheme, cubeMode)
                                  : notFoundOutput(command);

      const nudge = contextualNudge(name, visitedCommandsRef.current, cubeVisible, cubeHistoryRef.current.length > 0);
      write(`${output}${nudge ? `${newline}${newline}${nudge}` : ""}${newline}${newline}`);
      writePrompt();
    },
    [clearTypingTimers, cubeMode, cubeVisible, markEnteredTerminal, runCubeCommand, terminalTheme, write, writeHumanTypedText, writePrompt],
  );

  const handleData = useCallback(
    (data: string) => {
      if (data === "\x03") {
        clearTypingTimers();
        write("^C");
        write(newline);
        currentLineRef.current = "";
        writePrompt();
        return;
      }

      if (data === "\x0c") {
        clearTypingTimers();
        setSignatureRunId(0);
        write("\x1b[2J\x1b[H");
        currentLineRef.current = "";
        writePrompt();
        return;
      }

      if (data === "\r" || data === "\n") {
        const command = currentLineRef.current;
        write(newline);
        currentLineRef.current = "";
        runCommand(command);
        return;
      }

      if (data === "\x7f" || data === "\b") {
        if (currentLineRef.current.length > 0) {
          currentLineRef.current = currentLineRef.current.slice(0, -1);
          write("\b \b");
        }
        return;
      }

      if (data === "\x1b[A") {
        const history = historyRef.current;
        if (history.length === 0) return;
        const nextIndex =
          historyIndexRef.current === null
            ? history.length - 1
            : Math.max(0, historyIndexRef.current - 1);
        historyIndexRef.current = nextIndex;
        replaceInputLine(history[nextIndex]);
        return;
      }

      if (data === "\x1b[B") {
        const history = historyRef.current;
        if (history.length === 0 || historyIndexRef.current === null) return;
        const nextIndex = historyIndexRef.current + 1;
        if (nextIndex >= history.length) {
          historyIndexRef.current = null;
          replaceInputLine("");
          return;
        }
        historyIndexRef.current = nextIndex;
        replaceInputLine(history[nextIndex]);
        return;
      }

      if (data === "\t") {
        const current = currentLineRef.current;
        const matches = completionCandidates(current);
        if (matches.length === 1 && matches[0] !== current) {
          replaceInputLine(matches[0]);
          return;
        }
        if (matches.length !== 1) {
          write(`${newline}${completionOutput(current, matches)}${newline}`);
          writePrompt();
          write(current);
        }
        return;
      }

      if (data.startsWith("\x1b")) return;

      const printable = data.replace(/[\r\n]/g, "");
      if (printable) {
        setSignatureRunId(0);
        markEnteredTerminal();
        currentLineRef.current += printable;
        write(printable);
      }
    },
    [clearTypingTimers, markEnteredTerminal, replaceInputLine, runCommand, write, writePrompt],
  );

  const handleReady = useCallback(() => {
    setTerminalError(null);
    const bootRun = bootRunRef.current + 1;
    bootRunRef.current = bootRun;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (bootRun !== bootRunRef.current) return;
        write(bootOutput());
        writePrompt();
      });
    });
  }, [write, writePrompt]);

  const handleTerminalError = useCallback((error: unknown) => {
    setTerminalError(error instanceof Error ? error.message : "Terminal failed to load.");
  }, []);

  return (
    <main className="terminal-stage min-h-dvh bg-zinc-950 p-2 text-zinc-100 sm:p-4">
      <LogueBackdrop />
      <section className="terminal-machine" aria-label="Interactive portfolio terminal">
        {!hasEnteredTerminal ? <LogueBackdrop className="logue-terminal-fire-canvas" variant="fire" /> : null}
        <SignatureDrawLayer runId={signatureRunId} />
        <RubiksThreeOverlay
          visible={cubeVisible}
          state={cubeState}
          mode={cubeMode}
          activeMove={cubeActiveMove}
          moveTick={cubeMoveTick}
          hasScramble={cubeLastScramble.length > 0 || cubeLastSolution.length > 0}
        />
        <SetupThreeOverlay visible={setupVisible} />
        <div className="terminal-chrome">
          <span className="terminal-label">portfolio shell</span>
          <div className="terminal-title">
            <span>max@portfolio</span>
          </div>
          <span className="terminal-label terminal-status">
            <span className="terminal-status-dot" aria-hidden="true" />
            systems ready
          </span>
        </div>
        <Terminal
          ref={ref}
          className="portfolio-terminal"
          theme={terminalTheme}
          autoResize
          cursorBlink={false}
          onData={handleData}
          onReady={handleReady}
          onError={handleTerminalError}
        />
        {terminalError ? <p className="terminal-error">{terminalError}</p> : null}
      </section>
    </main>
  );
}

export default App;
