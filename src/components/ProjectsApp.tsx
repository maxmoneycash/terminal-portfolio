/** Selected work first; the full repository archive is one click away. */
import { useEffect, useMemo, useRef, useState } from "react";
import githubProjects from "../data/github-projects.json";
import { portfolio, type Project } from "../data/portfolio";
import { ScrollPane } from "../xp/ScrollPane";
import type { AppId } from "../xp/types";
import { CommitSummary } from "./CommitSummary";
import type { LiveProject } from "./LiveProjectApp";

type Repository = (typeof githubProjects.repositories)[number];
type RepositoryFilter = "all" | "maxmoneycash" | "SeamMoney";
const selectedProjects: Project[] = portfolio.projects.filter((project) => "demoId" in project);
const moreProjects = portfolio.projects.filter((project) => !("demoId" in project));

function ProjectPreview({ project, playing, onPlay }: {
  project: Project;
  playing: boolean;
  onPlay: () => void;
}) {
  const video = portfolio.videos.find((item) => item.id === project.demoId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (playing) void videoRef.current?.play().catch(() => {});
  }, [playing]);

  if (!video) return null;
  return (
    <div className="project-preview">
      {playing ? (
        <video
          ref={videoRef}
          src={video.sources[0].src}
          poster={video.poster}
          controls
          playsInline
          autoPlay
          muted
          aria-label={`${project.name} demo`}
          onError={() => setFailed(true)}
        />
      ) : (
        <button type="button" onClick={onPlay} aria-label={`Watch ${project.name} demo`}>
          <img src={video.poster} width={video.width} height={video.height} alt="" loading="lazy" />
          <span className="project-play"><span aria-hidden="true">▶</span> Watch demo</span>
        </button>
      )}
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
  const [view, setView] = useState<"selected" | "all" | "live">("selected");
  const [playing, setPlaying] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RepositoryFilter>("all");
  const { repositories } = githubProjects;
  const visibleRepositories = useMemo(() => repositories.filter((repository) => {
    const matchesFilter = !repository.private && (filter === "all" || repository.owner === filter);
    const terms = [repository.owner, repository.name, repository.description, repository.language].join(" ").toLowerCase();
    return matchesFilter && (view !== "live" || Boolean(repository.homepage)) && terms.includes(query.trim().toLowerCase());
  }), [repositories, filter, query, view]);

  useEffect(() => {
    if (!active) setPlaying(null);
  }, [active]);

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
          <a href={portfolio.links.email}>Contact ↗</a>
        </div>
      </header>
      <CommitSummary active={active} onOpen={() => openApp("stats")} />
      <nav className="projects-views" aria-label="Project views">
        <button type="button" aria-pressed={view === "selected"} onClick={() => { setView("selected"); setPlaying(null); }}>Selected work</button>
        <button type="button" aria-pressed={view === "all"} onClick={() => { setView("all"); setPlaying(null); }}>GitHub <span>{repositories.length}</span></button>
        <button type="button" aria-pressed={view === "live"} onClick={() => { setView("live"); setPlaying(null); }}>Live apps</button>
      </nav>
      <ScrollPane className="projects-scroll" key={view}>
        {view === "selected" ? (
          <div className="selected-work">
            {selectedProjects.map((project) => (
              <article className="selected-project" key={project.name} aria-labelledby={`project-${project.demoId}`}>
                <ProjectPreview project={project} playing={playing === project.demoId && active} onPlay={() => setPlaying(project.demoId ?? null)} />
                <div className="project-copy">
                  <p className="project-category">{project.category}</p>
                  <h2 id={`project-${project.demoId}`}>{project.name}</h2>
                  <p className="project-summary">{project.summary}</p>
                  <div className="project-links">
                    {project.link && project.link !== project.code ? <button className="xp-control primary" type="button" onClick={() => onOpenSite({ name: project.name, url: project.link! })}>Open app</button> : null}
                    {project.code ? <a href={project.code} target="_blank" rel="noreferrer" aria-label={`View ${project.name} source code`}>Code ↗</a> : null}
                  </div>
                  <details className="project-details">
                    <summary>Build notes</summary>
                    <p className="project-stack">{project.stack}</p>
                    <dl>{project.details?.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.text}</dd></div>)}</dl>
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
        ) : (
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
                  {repository.homepage ? <button className="github-live-link" type="button" onClick={() => onOpenSite({ name: repository.name, url: repository.homepage! })} aria-label={`Open ${repository.name} app`}>Open app ↗</button> : null}
                </div>
                {repository.description ? <p>{repository.description}</p> : null}
                <div className="github-repo-meta"><span>{repository.owner}</span>{repository.stars > 0 ? <span>{repository.stars} stars</span> : null}{repository.language ? <span>{repository.language}</span> : null}{repository.archived ? <span>Archived</span> : null}{repository.fork ? <span>Fork</span> : null}</div>
              </li>)}
            </ul>
            {!visibleRepositories.length ? <div className="github-repo-empty"><p>No matches.</p><button className="xp-control" type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button></div> : null}
          </section>
        )}
      </ScrollPane>
    </div>
  );
}
