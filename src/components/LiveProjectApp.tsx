import { useEffect, useState } from "react";
import type { LiveProject } from "../data/liveApps";
import { CopyLink } from "./CopyLink";
import { routeHash } from "../lib/navigation";
export type { LiveProject } from "../data/liveApps";

// These public deployments explicitly deny framing. Respect their policies
// instead of presenting Chromium's blank "refused to connect" document.
const externalOnlyHosts = new Set(["cash.trading", "commits.sh", "github.com", "tokenmaxxing.sh", "datacenter-globe.vercel.app", "eliza.army", "explorer.aptoslabs.com"]);

export function LiveProjectApp({ project }: { project: LiveProject | null }) {
  const [reload, setReload] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const frameKey = `${project?.url}:${reload}`;
  useEffect(() => {
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 12_000);
    return () => window.clearTimeout(timer);
  }, [frameKey]);
  if (!project) return <div className="live-project-empty">Choose an app from My Projects.</div>;
  const url = new URL(project.url);
  const externalOnly = project.mode !== "embed" || url.protocol !== "https:" || externalOnlyHosts.has(url.hostname.replace(/^www\./, ""));
  return (
    <div className="live-project-app">
      <div className="live-project-toolbar">
        <span title={project.url}>{new URL(project.url).hostname}</span>
        {!externalOnly ? <button type="button" onClick={() => setReload((value) => value + 1)}>Refresh</button> : null}
        {project.id ? <CopyLink href={routeHash({ app: "browser", site: project.id })} /> : null}
        <a href={project.url} target="_blank" rel="noreferrer">Open in new tab ↗</a>
      </div>
      {externalOnly ? (
        <div className="live-project-external">
          <img src="/xp/gui/desktop/projects.webp" width="48" height="48" alt="" />
          <h1>{project.name}</h1>
          <p>This site opens in its own browser tab.</p>
          <a className="xp-control primary" href={project.url} target="_blank" rel="noreferrer">Open live site ↗</a>
        </div>
      ) : <div className="live-project-stage">
        {loadedKey !== frameKey ? <div className="live-project-loading" role="status">{slow ? "Still loading… Refresh or open in a new tab." : "Opening app…"}</div> : null}
        <iframe
        key={frameKey}
        onLoad={() => setLoadedKey(frameKey)}
        src={project.url}
        title={`${project.name} live app`}
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-pointer-lock"
        allow="fullscreen; clipboard-write"
        allowFullScreen
      /></div>}
      {!externalOnly ? <p className="live-project-help">Not loading? Open in a new tab.</p> : null}
    </div>
  );
}
