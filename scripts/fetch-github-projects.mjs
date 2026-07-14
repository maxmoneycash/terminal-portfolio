#!/usr/bin/env node
// Regenerates src/data/github-projects.json from live GitHub data (both
// accounts, private repos included) using the local `gh` auth. Only repo
// metadata ships to the site — never code. Token counts are estimated from
// GitHub's per-language byte totals at ~4 bytes/token.
//
// Usage: npm run projects:refresh

import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const owners = ["maxmoneycash", "seammoney"];
const outPath = new URL("../src/data/github-projects.json", import.meta.url);

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
    "name,description,isPrivate,isFork,isArchived,homepageUrl,pushedAt,primaryLanguage",
  ]);

const languageBytes = async (owner, name) => {
  try {
    const languages = await gh(["api", `repos/${owner}/${name}/languages`]);
    return Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
  } catch {
    return 0;
  }
};

const mapWithConcurrency = async (items, limit, task) => {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
};

const normalizeHomepage = (url) => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const all = [];
for (const owner of owners) {
  const repos = await listRepos(owner);
  console.log(`${owner}: ${repos.length} repos`);
  const enriched = await mapWithConcurrency(repos, 8, async (repo) => {
    const bytes = await languageBytes(owner, repo.name);
    return {
      owner,
      name: repo.name,
      description: repo.description || null,
      private: repo.isPrivate,
      fork: repo.isFork,
      archived: repo.isArchived,
      homepage: normalizeHomepage(repo.homepageUrl),
      pushedAt: repo.pushedAt,
      language: repo.primaryLanguage?.name ?? null,
      codeBytes: bytes,
      tokens: Math.round(bytes / 4),
    };
  });
  all.push(...enriched);
}

all.sort((a, b) => b.tokens - a.tokens);

const payload = {
  generatedAt: new Date().toISOString(),
  totalTokens: all.reduce((sum, repo) => sum + repo.tokens, 0),
  repos: all,
};

await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${all.length} repos, ~${(payload.totalTokens / 1e6).toFixed(1)}M code tokens → src/data/github-projects.json`);
