import github from "./github-projects.json";
import checks from "./live-apps.json";
import type { Project } from "./portfolio";

export type LiveProject = { id?: string; name: string; url: string; mode?: "embed" | "external"; description?: string | null };

export const liveApps: LiveProject[] = checks.apps.flatMap(check => {
  const repo = github.repositories.find(repo => `${repo.owner}/${repo.name}` === check.id && !repo.private && !repo.fork && !repo.archived);
  return check.available && repo?.homepage === check.url ? [{
    id: check.id, name: repo.name, url: check.url,
    mode: check.mode === "embed" ? "embed" : "external", description: repo.description,
  }] : [];
});

const approvedSites: LiveProject[] = [
  { id: "aptos-vs-megaeth", name: "Aptos vs MegaETH", url: "https://aptos-polymarket.vercel.app/", mode: "embed" },
  { id: "whop-finance", name: "Whop Finance", url: "https://whop.finance/", mode: "embed" },
  { id: "commits-sh", name: "commits.sh", url: "https://commits.sh/", mode: "external" },
];

function normalize(url: string) { try { return new URL(url).href.replace(/\/$/, ""); } catch { return ""; } }
export function siteForUrl(url: string): LiveProject | undefined {
  return [...liveApps, ...approvedSites].find(site => normalize(site.url) === normalize(url));
}
export function siteForId(id?: string) {
  return [...liveApps, ...approvedSites].find(site => site.id === id);
}
export function projectId(project: Project) {
  return project.id ?? project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
