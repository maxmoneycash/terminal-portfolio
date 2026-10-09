/** Selected work first, as an XP filmstrip; the repository archive is one click away. */
import { useMemo, useState } from "react";
import githubProjects from "../data/github-projects.json";
import { portfolio, type Project } from "../data/portfolio";
import { ScrollPane } from "../xp/ScrollPane";
import { ProjectFilmstrip } from "./ProjectFilmstrip";
import type { AppId } from "../xp/types";
import { CommitSummary } from "./CommitSummary";
import type { LiveProject } from "./LiveProjectApp";
import { liveApps } from "../data/liveApps";
import { navigate, useRoute } from "../lib/navigation";

type Repository = (typeof githubProjects.repositories)[number];
type RepositoryFilter = "all" | "maxmoneycash" | "SeamMoney";
const selectedProjects: Project[] = portfolio.projects.filter((project) => "featured" in project && project.featured);
const moreProjects = portfolio.projects.filter((project) => !("featured" in project && project.featured));

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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RepositoryFilter>("all");
  const { repositories } = githubProjects;
  const visibleRepositories = useMemo(() => repositories.filter((repository) => {
    const matchesFilter = !repository.private && (filter === "all" || repository.owner === filter);
    const terms = [repository.owner, repository.name, repository.description, repository.language].join(" ").toLowerCase();
    return matchesFilter && (view !== "live" || liveApps.some(app => app.id === `${repository.owner}/${repository.name}`)) && terms.includes(query.trim().toLowerCase());
  }), [repositories, filter, query, view]);

  const filters: { id: RepositoryFilter; label: string }[] = [
    { id: "all", label: "All" }, { id: "maxmoneycash", label: "Max" },
    { id: "SeamMoney", label: "SeamMoney" },
  ];
  const views = [
    { id: "selected", label: "Work", icon: "start-menu/photos.webp" },
    { id: "all", label: "GitHub", icon: "start-menu/github.webp" },
    { id: "live", label: "Live apps", icon: "desktop/projects.webp" },
  ];

  return (
    <div className="projects-app">
      <div className="projects-layout">
      <nav className="projects-toolbar" aria-label="My Projects">
        {views.map((item) => (
          <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => setView(item.id)}>
            <img src={`/xp/gui/${item.icon}`} alt="" /><span>{item.label}</span>
          </button>
        ))}
        <span className="projects-toolbar-sep" aria-hidden="true" />
        <button type="button" onClick={() => openApp("resume")}>
          <img src="/xp/gui/desktop/resume.webp" alt="" /><span>Résumé</span>
        </button>
        <button type="button" onClick={() => openApp("contact")}>
          <img src="/xp/gui/desktop/contact.webp" alt="" /><span>Contact</span>
        </button>
      </nav>
      <div className="projects-panel" hidden={view !== "selected"}>
        <ProjectFilmstrip
          projects={selectedProjects}
          active={active && view === "selected"}
          selectedId={route.app === "projects" ? route.project : undefined}
          onOpenSite={onOpenSite}
        />
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
            {!query && filter === "all" ? <section className="more-projects" aria-labelledby="more-projects-heading">
              <h2 id="more-projects-heading">Also built</h2>
              {moreProjects.map((project) => (
                <div className="more-project" key={project.name}>
                  {project.link?.startsWith("https://github.com/") ? <a href={project.link} target="_blank" rel="noreferrer"><strong>{project.name} ↗</strong></a> : <button type="button" onClick={() => project.link && onOpenSite({ name: project.name, url: project.link })}><strong>{project.name} ↗</strong></button>}
                  <span>{project.summary}</span>
                </div>
              ))}
            </section> : null}
          </section>
      </ScrollPane> : null}
      <footer className="projects-status">
        <CommitSummary active={active} onOpen={() => openApp("stats")} />
        <button type="button" onClick={onWatchIntro}>
          <img src="/xp/gui/start-menu/mediaPlayer.webp" alt="" />Watch intro
        </button>
      </footer>
      </div>
    </div>
  );
}
