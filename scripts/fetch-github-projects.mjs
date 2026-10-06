#!/usr/bin/env node
// Anonymous requests only: no gh, GH_TOKEN, or GITHUB_TOKEN. The build must
// never receive private GitHub metadata, even on an authenticated machine.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const headers = { Accept: "application/vnd.github+json", "User-Agent": "MaxXP-public-portfolio" };
const owners = ["maxmoneycash", "SeamMoney"];

export async function publicGithub(path, request = fetch) {
  const response = await request(`https://api.github.com/${path}`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Public GitHub request failed (${response.status}): ${path}`);
  return response.json();
}

function homepage(value) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value.trim() : `https://${value.trim()}`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function publicRepository(repo) {
  if (repo.private !== false || repo.visibility !== "public") {
    throw new Error("Refusing to publish a non-public repository");
  }
  // Explicit field selection prevents other response data entering the bundle.
  return {
    owner: repo.owner.login,
    name: repo.name,
    description: repo.description,
    private: false,
    fork: repo.fork,
    archived: repo.archived,
    homepage: homepage(repo.homepage),
    pushedAt: repo.pushed_at,
    language: repo.language,
    url: repo.html_url,
    license: repo.license?.spdx_id ?? null,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
  };
}

async function refresh() {
  const repositories = [];
  for (const owner of owners) {
    for (let page = 1; ; page++) {
      const batch = await publicGithub(`users/${owner}/repos?type=owner&sort=pushed&per_page=100&page=${page}`);
      if (!Array.isArray(batch)) throw new Error("Unexpected GitHub repository response");
      repositories.push(...batch.map(publicRepository));
      if (batch.length < 100) break;
    }
    console.log(`${owner}: ${repositories.filter((repo) => repo.owner.toLowerCase() === owner.toLowerCase()).length} public repositories`);
  }
  repositories.sort((a, b) => Date.parse(b.pushedAt) - Date.parse(a.pushedAt));
  const user = await publicGithub("users/maxmoneycash");
  const payload = {
    generatedAt: new Date().toISOString(),
    profile: {
      login: user.login,
      name: user.name || user.login,
      bio: user.bio,
      followers: user.followers,
      following: user.following,
      location: user.location,
      avatarUrl: user.avatar_url,
      url: user.html_url,
    },
    repositories,
  };
  // Write only after every page and validation succeeds. Any error blocks build.
  await writeFile(new URL("../src/data/github-projects.json", import.meta.url), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Saved ${repositories.length} public repositories.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await refresh();
