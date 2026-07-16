#!/usr/bin/env node
// Regenerates the curated repository catalogue used by the MaxXP Projects
// window. GitHub supplies current metadata, but this allowlist controls which
// repositories ship. Private repository code is never read or exposed.
//
// Usage: npm run projects:refresh

import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const outPath = new URL("../src/data/github-projects.json", import.meta.url);

const curated = {
  maxmoneycash: [
    "maxmoneycash",
    "workforce-radar",
    "protocol-tax",
    "commit-markets",
    "yank",
    "terminal-portfolio",
    "cloned-websites",
    "peat-ui",
    "presidio-atlas",
    "sunmaxxed",
    "loom-reach",
    "ligata",
    "cairn",
    "peptide-app",
    "commit-markets-internal",
    "aptos-investigation",
    "options-payoff-motion",
    "holo",
    "move-gacha",
    "ohlone-unicode",
    "datacenter-globe",
    "whop-tutorials",
    "NIPAHSCAN",
    "decibel-evolution",
    "whop-docs",
    "cash-trading-game",
    "megaeth-analysis",
    "explorer",
    "panoptic-audit",
  ],
  SeamMoney: [
    "cash.trading",
    ".github",
    "stable-hop",
    "deepwap",
    "sui-options",
    "aptos-polymarket",
    "aptos-move-transpiler",
    "aptos-intelligence",
    "aptos-whop-finance",
    "aptos-poker",
    "emojicoin-payments",
    "cash-orderbook",
    "kraken-prediction-market",
    "aptos-privacy",
    "whop-docs",
    "aptos-whop-docs",
    "shelby-content-rewards",
    "fovea",
    "sol2move-app",
    "content-rewards-whitepaper",
    "blinknow",
    "aptos-consensus-visualizer",
    "caesars-calendar",
    "wickline",
    "tx-composer",
    "shelby-pulse",
    "temper-trade",
    "cash-markets",
  ],
};

const pinned = [
  "maxmoneycash/commit-markets",
  "maxmoneycash/yank",
  "maxmoneycash/terminal-portfolio",
  "SeamMoney/cash.trading",
  "SeamMoney/aptos-polymarket",
  "SeamMoney/tx-composer",
];

const achievements = [
  {
    name: "Pull Shark",
    count: 4,
    imageUrl: "https://github.githubassets.com/assets/pull-shark-default-498c279a747d.png",
  },
  {
    name: "Pair Extraordinaire",
    count: 4,
    imageUrl: "https://github.githubassets.com/assets/pair-extraordinaire-default-579438a20e01.png",
  },
  {
    name: "Quickdraw",
    count: 1,
    imageUrl: "https://github.githubassets.com/assets/quickdraw-default-39c6aec8ff89.png",
  },
  {
    name: "YOLO",
    count: 1,
    imageUrl: "https://github.githubassets.com/assets/yolo-default-be0bbff04951.png",
  },
  {
    name: "Arctic Code Vault Contributor",
    count: 1,
    imageUrl: "https://github.githubassets.com/assets/arctic-code-vault-contributor-default-df8d74122a06.png",
  },
];

const organizationNames = ["CalPolyBlockchain", "Synth-Fi", "SeamMoney", "MoveStudioIDE"];

const gh = async (args) => {
  const { stdout } = await run("gh", args, { maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(stdout);
};

const listRepos = (owner) =>
  gh([
    "repo",
    "list",
    owner,
    "--limit",
    "300",
    "--json",
    "name,description,isPrivate,isFork,isArchived,homepageUrl,pushedAt,primaryLanguage,url,licenseInfo,stargazerCount,forkCount",
  ]);

const normalizeHomepage = (url) => {
  if (!url?.trim()) return null;
  return /^https?:\/\//.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
};

const repositories = [];
for (const [owner, names] of Object.entries(curated)) {
  const available = await listRepos(owner);
  const byName = new Map(available.map((repo) => [repo.name.toLowerCase(), repo]));

  for (const requestedName of names) {
    const repo = byName.get(requestedName.toLowerCase());
    if (!repo) throw new Error(`Curated repository not found: ${owner}/${requestedName}`);
    repositories.push({
      owner,
      name: repo.name,
      description: repo.description || null,
      private: repo.isPrivate,
      fork: repo.isFork,
      archived: repo.isArchived,
      homepage: normalizeHomepage(repo.homepageUrl),
      pushedAt: repo.pushedAt,
      language: repo.primaryLanguage?.name ?? null,
      url: repo.url,
      license: repo.licenseInfo?.spdxId || repo.licenseInfo?.name || null,
      stars: repo.stargazerCount,
      forks: repo.forkCount,
    });
  }

  console.log(`${owner}: ${names.length} curated repositories`);
}

const user = await gh(["api", "users/maxmoneycash"]);
const organizations = await Promise.all(
  organizationNames.map(async (login) => {
    const org = await gh(["api", `orgs/${login}`]);
    return { login: org.login, avatarUrl: org.avatar_url, url: org.html_url };
  }),
);

const payload = {
  generatedAt: new Date().toISOString(),
  profile: {
    login: user.login,
    name: user.name || user.login,
    descriptor: "money/markets",
    bio: user.bio || "Just here for the tech",
    followers: user.followers,
    following: user.following,
    location: user.location || "aptos, ca",
    avatarUrl: user.avatar_url,
    url: user.html_url,
    achievements,
    organizations,
  },
  pinned,
  repositories,
};

await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${repositories.length} curated repositories → src/data/github-projects.json`);
