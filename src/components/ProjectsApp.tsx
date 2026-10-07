/** Selected work first; the full repository archive is one click away. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import githubProjects from "../data/github-projects.json";
import { portfolio, type Project } from "../data/portfolio";
import { ScrollPane } from "../xp/ScrollPane";
import type { AppId } from "../xp/types";
import { CommitSummary } from "./CommitSummary";
import type { LiveProject } from "./LiveProjectApp";
import { liveApps, projectId } from "../data/liveApps";
import { navigate, routeHash, useRoute } from "../lib/navigation";
import { CopyLink } from "./CopyLink";

type Repository = (typeof githubProjects.repositories)[number];
type RepositoryFilter = "all" | "maxmoneycash" | "SeamMoney";
const selectedProjects: Project[] = portfolio.projects.filter((project) => "featured" in project && project.featured);
const moreProjects = portfolio.projects.filter((project) => !("featured" in project && project.featured));

function ProjectPreview({ project, playing, active, priority, onPlay, onOpenSite }: {
  project: Project;
  playing: boolean;
  active: boolean;
  priority: boolean;
  onPlay: () => void;
  onOpenSite: (project: LiveProject) => void;
}) {
  const video = portfolio.videos.find((item) => item.id === project.demoId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const resumeRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useLayoutEffect(() => {
    const element = previewRef.current;
    if (!expanded || !element) return;
    element.showPopover();
    element.querySelector<HTMLButtonElement>(".project-collapse")?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", escape);
    return () => { if (element.matches(":popover-open")) element.hidePopover(); window.removeEventListener("keydown", escape); };
  }, [expanded]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (playing && active) void element.play().catch(() => {});
    else element.pause();
  }, [playing, started]);
  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    const sync = () => {
      if (!active || document.hidden) {
        if (!element.paused) resumeRef.current = true;
        element.pause();
      } else if (playing && resumeRef.current) {
        resumeRef.current = false;
        void element.play().catch(() => {});
      }
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [active, playing]);

  const play = () => { setStarted(true); onPlay(); void videoRef.current?.play().catch(() => {}); };
  const enlarge = () => {
    play();
    if (previewRef.current?.requestFullscreen) void previewRef.current.requestFullscreen().catch(() => setExpanded(true));
    else if ((videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void } | null)?.webkitEnterFullscreen) {
      (videoRef.current as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
    } else setExpanded(true);
  };

  if (!video) return project.poster ? <div className="project-preview"><button type="button" onClick={() => project.link && onOpenSite({ name: project.name, url: project.link })} aria-label={`Try ${project.name}`}><img src={project.poster} width="1440" height="900" alt={`${project.name} running on the T-Deck`} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} /><span className="project-play">Try app →</span></button></div> : null;
  return (
    <div className="project-preview" ref={previewRef} popover={expanded ? "manual" : undefined}>
      {started ? (
        <video
          ref={videoRef}
          src={video.sources[0].src}
          poster={video.poster}
          controls
          playsInline
          muted
          aria-label={`${project.name} demo`}
          onPlay={onPlay}
          onError={() => setFailed(true)}
        />
      ) : (
        <button type="button" onClick={play} aria-label={`Watch ${project.name} demo`}>
          <picture>
            {project.id === "aptos-vs-megaeth" ? <source media="(max-width: 620px)" srcSet="/projects/aptos-focus.jpg" /> : null}
            <img src={video.poster} width={video.width} height={video.height} alt="" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} />
          </picture>
          <span className="project-play"><span aria-hidden="true">▶</span> Watch demo</span>
        </button>
      )}
      <div className="project-media-actions">{expanded ? <button type="button" className="project-collapse" onClick={() => setExpanded(false)}>Close enlarged view</button> : <button type="button" onClick={enlarge} aria-label={`Enlarge ${project.name} demo`}>⛶ Enlarge</button>}<a href={video.sources[0].src} target="_blank" rel="noreferrer">Full recording ↗</a></div>
      {failed && playing ? <a className="project-video-fallback" href={video.sources[0].src}>Open recording ↗</a> : null}
    </div>
  );
}

function RepositoryTitle({ repository }: { repository: Repository }) {
  return <a className="github-repo-name" href={repository.url} target="_blank" rel="noreferrer">{repository.name}</a>;
}

export function ProjectsApp({ active, openApp, onWatchIntro, onOpenSite }: {
  active: boolean;
  openApp: (id: AppId) => void;
  onWatchIntro: () => void;
  onOpenSite: (project: LiveProject) => void;
}) {
  const route = useRoute();
  const view = route.app === "projects" && ["all", "live"].includes(route.view ?? "") ? route.view : "selected";
  const setView = (next: string) => { setQuery(""); setFilter("all"); navigate({ app: "projects", view: next }); };
  const [playing, setPlaying] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RepositoryFilter>("all");
  const { repositories } = githubProjects;
  const visibleRepositories = useMemo(() => repositories.filter((repository) => {
    const matchesFilter = !repository.private && (filter === "all" || repository.owner === filter);
    const terms = [repository.owner, repository.name, repository.description, repository.language].join(" ").toLowerCase();
    return matchesFilter && (view !== "live" || liveApps.some(app => app.id === `${repository.owner}/${repository.name}`)) && terms.includes(query.trim().toLowerCase());
  }), [repositories, filter, query, view]);

  const selectedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (route.app !== "projects" || !route.project) return;
    const target = selectedProjects.find(project => projectId(project) === route.project);
    setPlaying(current => target?.demoId === current ? current : null);
  }, [route.app, route.project]);
  useEffect(() => {
    if (route.app !== "projects" || !route.project || view !== "selected") return;
    const item = Array.from(selectedRef.current?.querySelectorAll<HTMLElement>("[data-project]") ?? []).find(item => item.dataset.project === route.project);
    item?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [route.app, route.project, view]);

  const filters: { id: RepositoryFilter; label: string }[] = [
    { id: "all", label: "All" }, { id: "maxmoneycash", label: "Max" },
    { id: "SeamMoney", label: "SeamMoney" },
  ];

  return (
    <div className="projects-app">
      <header className="projects-header">
        <div><h1>{portfolio.name}</h1><p>{portfolio.title}</p></div>
        <div className="projects-header-links">
          <button type="button" onClick={() => openApp("resume")}>Résumé</button>
          <button type="button" onClick={() => openApp("contact")}>Contact</button>
        </div>
      </header>
      <CommitSummary active={active} onOpen={() => openApp("stats")} />
      <nav className="projects-views" aria-label="Project views">
        <button type="button" aria-pressed={view === "selected"} onClick={() => { setView("selected"); setPlaying(null); }}>Selected work</button>
        <button type="button" aria-pressed={view === "all"} onClick={() => { setView("all"); setPlaying(null); }}>GitHub <span>{repositories.length}</span></button>
        <button type="button" aria-pressed={view === "live"} onClick={() => { setView("live"); setPlaying(null); }}>Live apps</button>
      </nav>
      <div className="projects-panel" hidden={view !== "selected"}>
      <ScrollPane className="projects-scroll">
          <div className="selected-work" ref={selectedRef}>
            {selectedProjects.map((project, index) => (
              <article className="selected-project" key={project.name} data-project={projectId(project)} aria-labelledby={`project-${projectId(project)}`}>
                <ProjectPreview project={project} priority={index === 0} active={active && view === "selected"} playing={playing === project.demoId} onPlay={() => { setPlaying(project.demoId ?? null); navigate({ app: "projects", project: projectId(project) }); }} onOpenSite={onOpenSite} />
                <div className="project-copy">
                  <p className="project-category">{project.category}</p>
                  <h2 id={`project-${projectId(project)}`}><a href={routeHash({ app: "projects", project: projectId(project) })}>{project.name}</a></h2>
                  <p className="project-summary">{project.summary}</p>
                  <div className="project-links">
                    {project.link && project.link !== project.code ? <button className="xp-control primary" type="button" onClick={() => onOpenSite({ name: project.name, url: project.link! })}>Open app</button> : null}
                    {project.code ? <a href={project.code} target="_blank" rel="noreferrer" aria-label={`View ${project.name} source code`}>Code ↗</a> : null}
                    <CopyLink href={routeHash({ app: "projects", project: projectId(project) })} />
                  </div>
                  <details className="project-details">
                    <summary>Build notes</summary>
                    <p className="project-stack">{project.stack}</p>
                    <dl>{project.contribution ? <div><dt>My work</dt><dd>{project.contribution}</dd></div> : null}{project.details?.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.text}</dd></div>)}</dl>
                  </details>
                </div>
              </article>
            ))}
            <section className="more-projects" aria-labelledby="more-projects-heading">
              <h2 id="more-projects-heading">Also built</h2>
              {moreProjects.map((project) => (
                <div className="more-project" key={project.name}>
                  {project.link?.startsWith("https://github.com/") ? <a href={project.link} target="_blank" rel="noreferrer"><strong>{project.name} ↗</strong></a> : <button type="button" onClick={() => project.link && onOpenSite({ name: project.name, url: project.link })}><strong>{project.name} ↗</strong></button>}
                  <span>{project.summary}</span>
                </div>
              ))}
            </section>
            <footer className="projects-footer">
              <button type="button" onClick={() => openApp("demos")}>All {portfolio.videos.length} recordings ↗</button>
              <button type="button" onClick={onWatchIntro}>Watch intro</button>
              <a href={portfolio.links.github} target="_blank" rel="noreferrer">GitHub ↗</a>
            </footer>
          </div>
      </ScrollPane>
      </div>
      {view !== "selected" ? <ScrollPane className="projects-scroll" key={view}>
          <section className="project-archive" aria-label="Repository archive">
            <div className="github-repo-tools">
              <input aria-label="Search projects" type="search" placeholder="Search projects…" value={query} onChange={(event) => setQuery(event.target.value)} />
              <div className="github-repo-filters" aria-label="Filter repositories">
                {filters.map((option) => <button key={option.id} type="button" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>{option.label}</button>)}
              </div>
            </div>
            <p className="archive-count" role="status">{visibleRepositories.length} {view === "live" ? "live apps" : "public repositories"}</p>
            <p className="archive-source"><a href={githubProjects.profile.url} target="_blank" rel="noreferrer">@{githubProjects.profile.login} ↗</a> · Updated {new Date(githubProjects.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
            <ul className="github-repo-list">
              {visibleRepositories.map((repository) => <li key={`${repository.owner}/${repository.name}`}>
                <div className="github-repo-title-row">
                  <RepositoryTitle repository={repository} />
                  {view === "live" && repository.homepage ? <button className="github-live-link" type="button" onClick={() => onOpenSite({ name: repository.name, url: repository.homepage! })} aria-label={`Open ${repository.name} app`}>Open app →</button> : repository.homepage ? <a className="github-live-link" href={repository.homepage} target="_blank" rel="noreferrer">Website ↗</a> : null}
                </div>
                {repository.description ? <p>{repository.description}</p> : null}
                <div className="github-repo-meta"><span>{repository.owner}</span>{repository.stars > 0 ? <span>{repository.stars} stars</span> : null}{repository.language ? <span>{repository.language}</span> : null}{repository.archived ? <span>Archived</span> : null}{repository.fork ? <span>Fork</span> : null}</div>
              </li>)}
            </ul>
            {!visibleRepositories.length ? <div className="github-repo-empty"><p>No matches.</p><button className="xp-control" type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button></div> : null}
          </section>
      </ScrollPane> : null}
    </div>
  );
}
