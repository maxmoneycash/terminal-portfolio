/**
 * My Projects: the GitHub repositories explorer. Loaded on demand (it carries
 * framer-motion for the filter and list animations), see WindowContent.
 */
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import githubProjects from "../data/github-projects.json";
import { cn } from "../lib/cn";
import { xp } from "../xp/types";
import { ScrollPane } from "../xp/ScrollPane";

type Repository = (typeof githubProjects.repositories)[number];
type RepositoryFilter = "all" | "maxmoneycash" | "SeamMoney" | "public" | "private";

const repositoryKey = (repository: Repository) => `${repository.owner}/${repository.name}`;

function languageClass(language: string | null) {
  return `is-${(language ?? "other").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function updatedLabel(value: string) {
  const date = new Date(value);
  const elapsed = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(elapsed / 3_600_000);
  const days = Math.floor(elapsed / 86_400_000);

  if (minutes < 2) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} minutes ago`;
  if (hours < 2) return "Updated 1 hour ago";
  if (hours < 24) return `Updated ${hours} hours ago`;
  if (days === 1) return "Updated yesterday";
  if (days < 7) return `Updated ${days} days ago`;
  if (days < 14) return "Updated last week";
  if (days < 31) return `Updated ${Math.floor(days / 7)} weeks ago`;
  if (days < 61) return "Updated last month";
  if (days < 365) return `Updated ${Math.floor(days / 30)} months ago`;
  return `Updated on ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function RepositoryTitle({ repository }: { repository: Repository }) {
  return repository.private ? (
    <span className="github-repo-name">{repository.name}</span>
  ) : (
    <a className="github-repo-name" href={repository.url} target="_blank" rel="noreferrer">
      {repository.name}
    </a>
  );
}

function RepositoryMeta({ repository }: { repository: Repository }) {
  return (
    <div className="github-repo-meta">
      {repository.language ? (
        <span>
          <i className={cn("github-language-dot", languageClass(repository.language))} aria-hidden="true" />
          {repository.language}
        </span>
      ) : null}
      {repository.license ? <span>{repository.license}</span> : null}
      {repository.stars > 0 ? <span>{repository.stars} stars</span> : null}
      {repository.forks > 0 ? <span>{repository.forks} forks</span> : null}
      <span>{updatedLabel(repository.pushedAt)}</span>
    </div>
  );
}

export function ProjectsApp() {
  const { profile, repositories, pinned, generatedAt } = githubProjects;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RepositoryFilter>("all");
  const reduceMotion = useReducedMotion();

  const visibleRepositories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return repositories.filter((repository) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "public" && !repository.private) ||
        (filter === "private" && repository.private) ||
        repository.owner === filter;
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;
      return [repository.owner, repository.name, repository.description, repository.language]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [filter, query, repositories]);

  const repositoriesByKey = useMemo(
    () => new Map(repositories.map((repository) => [repositoryKey(repository), repository])),
    [repositories],
  );
  const pinnedRepositories = pinned
    .map((key) => repositoriesByKey.get(key))
    .filter((repository): repository is Repository => Boolean(repository));
  const filterOptions: { id: RepositoryFilter; label: string }[] = [
    { id: "all", label: `All ${repositories.length}` },
    { id: "maxmoneycash", label: "Max" },
    { id: "SeamMoney", label: "Seam" },
    { id: "public", label: "Public" },
    { id: "private", label: "Private" },
  ];
  const repositoryGroups = ["maxmoneycash", "SeamMoney"].map((owner) => ({
    owner,
    repositories: visibleRepositories.filter((repository) => repository.owner === owner),
  }));
  const motionTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div className="github-projects-page">
      <ScrollPane className="github-projects-scroll">
        <div className="github-projects-layout">
          <aside className="github-profile" aria-label="GitHub profile summary">
            <a className="github-profile-avatar" href={profile.url} target="_blank" rel="noreferrer">
              <img src={profile.avatarUrl} width="160" height="160" alt={`${profile.login} on GitHub`} />
            </a>
            <div className="github-profile-title">
              <h1>{profile.name}</h1>
              <p>{profile.login} · {profile.descriptor}</p>
            </div>
            <p className="github-profile-bio">{profile.bio}</p>
            <div className="github-profile-follows">
              <a href={`${profile.url}?tab=followers`} target="_blank" rel="noreferrer">
                <strong>{profile.followers}</strong> followers
              </a>
              <span aria-hidden="true">·</span>
              <a href={`${profile.url}?tab=following`} target="_blank" rel="noreferrer">
                <strong>{profile.following}</strong> following
              </a>
            </div>
            <dl className="github-profile-facts">
              <div>
                <dt>Location</dt>
                <dd>{profile.location}</dd>
              </div>
              <div>
                <dt>GitHub</dt>
                <dd>
                  <a href={profile.url} target="_blank" rel="noreferrer">@{profile.login}</a>
                </dd>
              </div>
            </dl>

            <fieldset className="xp-group-box github-achievements">
              <legend>Achievements</legend>
              <ul>
                {profile.achievements.map((achievement) => (
                  <li key={achievement.name}>
                    <img src={achievement.imageUrl} width="42" height="42" alt="" loading="lazy" />
                    <span>
                      <strong>{achievement.name}</strong>
                      {achievement.count > 1 ? <small>×{achievement.count}</small> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </fieldset>

            <fieldset className="xp-group-box github-organizations">
              <legend>Organizations</legend>
              <div>
                {profile.organizations.map((organization) => (
                  <a
                    key={organization.login}
                    href={organization.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${organization.login} on GitHub`}
                    title={`@${organization.login}`}
                  >
                    <img src={organization.avatarUrl} width="34" height="34" alt="" loading="lazy" />
                  </a>
                ))}
              </div>
              <p>{profile.organizations.map((organization) => `@${organization.login}`).join(" · ")}</p>
            </fieldset>
          </aside>

          <main className="github-projects-main">
            <section className="github-pinned" aria-labelledby="github-pinned-heading">
              <div className="github-section-heading">
                <div>
                  <img src={`${xp}/gui/start-menu/github.webp`} width="24" height="24" alt="" />
                  <h2 id="github-pinned-heading">Pinned projects</h2>
                </div>
                <span>{pinnedRepositories.length} selected</span>
              </div>
              <div className="github-pinned-grid">
                {pinnedRepositories.map((repository) => (
                  <article className="github-pinned-card" key={repositoryKey(repository)}>
                    <div className="github-repo-title-row">
                      <RepositoryTitle repository={repository} />
                      <span className="github-visibility">{repository.private ? "Private" : "Public"}</span>
                    </div>
                    {repository.description ? <p>{repository.description}</p> : null}
                    <div className="github-pinned-footer">
                      <RepositoryMeta repository={repository} />
                      {repository.homepage ? (
                        <a
                          className="github-live-link"
                          href={repository.homepage}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open the live site for ${repository.name}`}
                        >
                          Live site ↗
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="github-repositories" aria-labelledby="github-repositories-heading">
              <div className="github-section-heading github-repositories-heading">
                <div>
                  <img src={`${xp}/gui/desktop/projects.webp`} width="24" height="24" alt="" />
                  <h2 id="github-repositories-heading">Repositories</h2>
                </div>
                <span aria-live="polite">{visibleRepositories.length} shown</span>
              </div>

              <div className="github-repo-tools">
                <label className="github-repo-search">
                  <span>Find a repository…</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search repositories"
                  />
                </label>
                <div className="github-repo-filters" aria-label="Filter repositories">
                  {filterOptions.map((option) => (
                    <motion.button
                      key={option.id}
                      type="button"
                      className={cn(filter === option.id && "is-active")}
                      aria-pressed={filter === option.id}
                      onClick={() => setFilter(option.id)}
                      whileTap={reduceMotion ? undefined : { y: 1 }}
                      transition={motionTransition}
                    >
                      {option.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="github-repository-catalogue">
                {repositoryGroups.map((group) =>
                  group.repositories.length > 0 ? (
                    <section className="github-repository-group" key={group.owner} aria-labelledby={`repos-${group.owner}`}>
                      <h3 id={`repos-${group.owner}`}>
                        <img src={`${xp}/gui/start-menu/github.webp`} width="18" height="18" alt="" />
                        {group.owner}
                        <span>{group.repositories.length}</span>
                      </h3>
                      <ul className="github-repo-list">
                        <AnimatePresence initial={false}>
                          {group.repositories.map((repository) => (
                            <motion.li
                              key={repositoryKey(repository)}
                              layout={reduceMotion ? false : "position"}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={motionTransition}
                            >
                              <div className="github-repo-title-row">
                                <RepositoryTitle repository={repository} />
                                <span className="github-visibility">{repository.private ? "Private" : "Public"}</span>
                                {repository.fork ? <span className="github-repo-state">Fork</span> : null}
                                {repository.archived ? <span className="github-repo-state">Archived</span> : null}
                                {repository.homepage ? (
                                  <a
                                    className="github-live-link"
                                    href={repository.homepage}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={`Open the live site for ${repository.name}`}
                                  >
                                    Live site ↗
                                  </a>
                                ) : null}
                              </div>
                              {repository.description ? <p>{repository.description}</p> : null}
                              <RepositoryMeta repository={repository} />
                            </motion.li>
                          ))}
                        </AnimatePresence>
                      </ul>
                    </section>
                  ) : null,
                )}
                {visibleRepositories.length === 0 ? (
                  <div className="github-repo-empty" role="status">
                    <img src={`${xp}/gui/start-menu/recently-used.webp`} width="40" height="40" alt="" />
                    <strong>No repositories found</strong>
                    <span>Clear the search or choose a different filter.</span>
                  </div>
                ) : null}
              </div>

              <p className="github-repo-footer">
                {repositories.length} curated repositories · refreshed{" "}
                {new Date(generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </section>
          </main>
        </div>
      </ScrollPane>
    </div>
  );
}
