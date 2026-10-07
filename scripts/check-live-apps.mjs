// Editorial selection is separate from the complete, unmodified GitHub archive.
// Only anonymous, already-public destinations are probed. No credentials/cookies.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const selectedApps = [
  "maxmoneycash/lilyshark", "maxmoneycash/orbital-works", "SeamMoney/cash.trading",
  "maxmoneycash/tokenmaxxing", "maxmoneycash/polar-browser-themes", "maxmoneycash/stock-game",
  "maxmoneycash/market-scout", "maxmoneycash/spectra", "maxmoneycash/tend",
  "maxmoneycash/loom-reach", "SeamMoney/sui-options", "maxmoneycash/options-payoff-motion",
  "maxmoneycash/ohlone-unicode", "maxmoneycash/army", "SeamMoney/zionbets_frontend",
  "maxmoneycash/datacenter-globe", "maxmoneycash/NIPAHSCAN",
];

export function frameMode(headers) {
  // Allow embedding only when no site policy prohibits this origin. Be
  // conservative with complex policies; opening a real tab always works.
  const xfo = headers.get("x-frame-options");
  const csp = headers.get("content-security-policy");
  return xfo || /frame-ancestors/i.test(csp ?? "") ? "external" : "embed";
}

export async function probe(url, request = fetch) {
  try {
    const response = await request(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
    const destination = new URL(response.url || url);
    const gated = destination.hostname === "vercel.com" && /login|sso/.test(destination.pathname);
    const result = { available: response.ok && !gated, mode: frameMode(response.headers) };
    await response.body?.cancel();
    return result;
  } catch { return { available: false, mode: "external" }; }
}

async function main() {
  const { repositories } = JSON.parse(await readFile(new URL("../src/data/github-projects.json", import.meta.url), "utf8"));
  const candidates = selectedApps.flatMap(id => {
    const repo = repositories.find(r => `${r.owner}/${r.name}` === id && r.private === false && !r.fork && !r.archived);
    return repo?.homepage ? [{ id, url: repo.homepage }] : [];
  });
  const apps = [];
  for (let i = 0; i < candidates.length; i += 4) {
    apps.push(...await Promise.all(candidates.slice(i, i + 4).map(async app => ({ ...app, ...await probe(app.url) }))));
  }
  const payload = { checkedAt: new Date().toISOString(), apps };
  await writeFile(new URL("../src/data/live-apps.json", import.meta.url), JSON.stringify(payload, null, 2) + "\n");
  console.log(`${apps.filter(app => app.available).length}/${apps.length} selected destinations reachable.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
