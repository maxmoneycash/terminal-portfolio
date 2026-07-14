import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion, type Variants } from "framer-motion";
import { portfolio } from "./data/portfolio";
import githubProjects from "./data/github-projects.json";
import { cn } from "./lib/cn";
import {
  easeInOut,
  easeOut,
  fadeThrough,
  motionTransition,
  press,
  quickItem,
  quickStagger,
  rise,
  sheet,
  stagger,
  staggerItem,
} from "./lib/motion";
import { MenuBar, type WindowMenu } from "./components/MenuBar";
import { ReelsApp } from "./components/ReelsApp";
import { StatsApp } from "./components/StatsApp";
import { Tooltip } from "./components/Tooltip";
import { TrayBalloon } from "./components/TrayBalloon";

type BootPhase = "boot" | "login" | "welcome" | "desktop";
type AppId = "about" | "resume" | "projects" | "demos" | "contact" | "stats";
type EdgeState = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};
type WindowRecord = {
  id: AppId;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
};
type DragState =
  | { mode: "move"; id: AppId; startX: number; startY: number; originX: number; originY: number }
  | { mode: "resize"; id: AppId; startX: number; startY: number; width: number; height: number };

const xp = "/xp";

const appCatalog: Record<
  AppId,
  {
    title: string;
    shortTitle: string;
    icon: string;
    desktopLabel: string;
    status: string;
    dimensions: { width: number; height: number; minWidth: number; minHeight: number };
  }
> = {
  about: {
    title: "About Max",
    shortTitle: "About",
    icon: `${xp}/gui/desktop/about.webp`,
    desktopLabel: "About Me",
    status: "Learn more about Max",
    dimensions: { width: 790, height: 650, minWidth: 440, minHeight: 390 },
  },
  resume: {
    title: "My Resume",
    shortTitle: "Resume",
    icon: `${xp}/gui/desktop/resume.webp`,
    desktopLabel: "My Resume",
    status: "Open or download the latest resume PDF",
    dimensions: { width: 720, height: 690, minWidth: 420, minHeight: 380 },
  },
  projects: {
    title: "My Projects",
    shortTitle: "Projects",
    icon: `${xp}/gui/desktop/projects.webp`,
    desktopLabel: "My Projects",
    status: "Select a project, then open the live build or source",
    dimensions: { width: 860, height: 710, minWidth: 520, minHeight: 420 },
  },
  demos: {
    title: "Demo Reel",
    shortTitle: "Demos",
    icon: `${xp}/gui/start-menu/mediaPlayer.webp`,
    desktopLabel: "Demo Reel",
    status: "Scroll the feed — every clip is a real screen recording",
    dimensions: { width: 620, height: 740, minWidth: 440, minHeight: 460 },
  },
  contact: {
    title: "Contact Me",
    shortTitle: "Contact",
    icon: `${xp}/gui/desktop/contact.webp`,
    desktopLabel: "Contact Me",
    status: "Compose a message to Max",
    dimensions: { width: 560, height: 390, minWidth: 420, minHeight: 300 },
  },
  stats: {
    title: "Task Manager",
    shortTitle: "Stats",
    icon: `${xp}/gui/start-menu/cmd.webp`,
    desktopLabel: "Dev Stats",
    status: "Live commit velocity and AI burn via commits.sh",
    dimensions: { width: 680, height: 780, minWidth: 470, minHeight: 430 },
  },
};

const desktopApps: AppId[] = ["about", "resume", "projects", "demos", "stats", "contact"];
const mobileDockApps: AppId[] = ["about", "projects", "demos", "stats", "contact"];

function externalLabel(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function playSound(name: "login" | "logoff" | "balloon") {
  const audio = new Audio(`${xp}/sounds/${name}.wav`);
  audio.volume = 0.42;
  void audio.play().catch(() => {});
}

function readCrtPreference() {
  try {
    return window.localStorage.getItem("maxxp:crt") === "on";
  } catch {
    return false;
  }
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function ScrollPane({ children, className }: { children: ReactNode; className?: string }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState<EdgeState>({ top: false, right: false, bottom: false, left: false });

  const updateEdges = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const epsilon = 2;
    const next = {
      top: viewport.scrollTop > epsilon,
      right: viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - epsilon,
      bottom: viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - epsilon,
      left: viewport.scrollLeft > epsilon,
    };
    setEdges((current) =>
      current.top === next.top &&
      current.right === next.right &&
      current.bottom === next.bottom &&
      current.left === next.left
        ? current
        : next,
    );
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateEdges();
    viewport.addEventListener("scroll", updateEdges, { passive: true });
    const resizeObserver = new ResizeObserver(updateEdges);
    resizeObserver.observe(viewport);
    if (viewport.firstElementChild) resizeObserver.observe(viewport.firstElementChild);

    return () => {
      viewport.removeEventListener("scroll", updateEdges);
      resizeObserver.disconnect();
    };
  }, [updateEdges, children]);

  return (
    <div
      className={cn(
        "scroll-surface",
        edges.top && "has-top-edge",
        edges.right && "has-right-edge",
        edges.bottom && "has-bottom-edge",
        edges.left && "has-left-edge",
        className,
      )}
    >
      <div className="scroll-viewport" ref={viewportRef} tabIndex={0}>
        <div className="scroll-content">{children}</div>
      </div>
      <motion.div className="scroll-edge scroll-edge-top" aria-hidden="true" animate={{ opacity: edges.top ? 1 : 0 }} transition={motionTransition.micro} />
      <motion.div className="scroll-edge scroll-edge-right" aria-hidden="true" animate={{ opacity: edges.right ? 1 : 0 }} transition={motionTransition.micro} />
      <motion.div className="scroll-edge scroll-edge-bottom" aria-hidden="true" animate={{ opacity: edges.bottom ? 1 : 0 }} transition={motionTransition.micro} />
      <motion.div className="scroll-edge scroll-edge-left" aria-hidden="true" animate={{ opacity: edges.left ? 1 : 0 }} transition={motionTransition.micro} />
    </div>
  );
}

function BootScreen() {
  const reduceMotion = useReducedMotion();
  const stages = ["Reading portfolio data", "Warming live telemetry", "Building your workspace"];
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const first = window.setTimeout(() => setStage(1), 520);
    const second = window.setTimeout(() => setStage(2), 1120);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, []);

  return (
    <motion.section
      className="xp-boot-screen"
      aria-label="Booting MaxXP"
      variants={fadeThrough}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div className="boot-center" variants={stagger} initial="hidden" animate="visible">
        <motion.div className="boot-logo-lockup" variants={staggerItem}>
          <span className="boot-logo-mark">MaxXP</span>
          <span className="boot-edition">Portfolio Edition</span>
        </motion.div>
        <motion.div className="boot-progress" aria-hidden="true" variants={staggerItem}>
          {[0, 1, 2].map((item) => (
            <motion.span
              key={item}
              animate={
                reduceMotion
                  ? { opacity: 0.7 }
                  : {
                      opacity: [0.25, 1, 0.25],
                      transform: [
                        "translate3d(-8px, 0, 0) scale(0.92)",
                        "translate3d(0, 0, 0) scale(1)",
                        "translate3d(8px, 0, 0) scale(0.92)",
                      ],
                    }
              }
              transition={{ duration: 0.9, delay: item * 0.12, repeat: Infinity, ease: easeInOut }}
            />
          ))}
        </motion.div>
        <div className="boot-status" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={stages[stage]}
              initial={{ opacity: 0, transform: "translate3d(0, 4px, 0)" }}
              animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
              exit={{ opacity: 0, transform: "translate3d(0, -4px, 0)" }}
              transition={motionTransition.short}
            >
              {stages[stage]}
            </motion.span>
          </AnimatePresence>
          <span>{stage + 1} / {stages.length}</span>
        </div>
      </motion.div>
      <motion.div className="boot-corner boot-left" variants={rise} initial="hidden" animate="visible">
        Real projects. Real telemetry.
      </motion.div>
      <motion.div className="boot-corner boot-right" variants={rise} initial="hidden" animate="visible">
        MaxXP · 2026
      </motion.div>
    </motion.section>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <motion.section
      className="xp-login-screen"
      aria-label="Log in"
      variants={fadeThrough}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div className="login-panel" variants={stagger} initial="hidden" animate="visible">
        <motion.div className="login-brand" variants={staggerItem}>
          <motion.span
            className="windows-flag"
            aria-hidden="true"
            initial={{ opacity: 0, transform: "translate3d(0, 8px, 0) rotate(-10deg) scale(0.9)" }}
            animate={{ opacity: 1, transform: "translate3d(0, 0, 0) rotate(-6deg) scale(1)" }}
            transition={motionTransition.spatial}
          >
            {[0, 1, 2, 3].map((item) => <i key={item} />)}
          </motion.span>
          <strong>
            Max<span>XP</span>
          </strong>
          <em>{portfolio.title}</em>
          <p>
            Open a workspace built around <span>real product proof</span>.
          </p>
        </motion.div>
        <motion.div className="login-divider" variants={staggerItem} />
        <motion.button
          className="login-user"
          type="button"
          autoFocus
          onClick={onLogin}
          variants={staggerItem}
          whileTap={press}
          transition={motionTransition.micro}
        >
          <span className="login-avatar">M</span>
          <span>
            <strong>{portfolio.name}</strong>
            <small>Enter MaxXP →</small>
          </span>
        </motion.button>
      </motion.div>
      <motion.div className="login-footer-left" variants={rise} initial="hidden" animate="visible">
        <span className="restart-dot" aria-hidden="true" />
        Available for ambitious technical work
      </motion.div>
      <motion.div className="login-footer-right" variants={rise} initial="hidden" animate="visible">
        <span>Projects, recordings, resume, and live developer telemetry.</span>
        <span>Desktop workspace · mobile app shell</span>
      </motion.div>
    </motion.section>
  );
}

function WelcomeScreen() {
  return (
    <motion.section
      className="xp-welcome-screen"
      aria-label="Welcome"
      initial={{ opacity: 0, transform: "translate3d(0, 2px, 0) scale(0.995)" }}
      animate={{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }}
      exit={{ opacity: 0, transform: "translate3d(0, -1px, 0) scale(0.998)" }}
      transition={motionTransition.short}
    >
      <motion.span
        initial={{ opacity: 0, transform: "translate3d(0, 10px, 0) scale(0.96)" }}
        animate={{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }}
        transition={motionTransition.spatial}
      >
        welcome
      </motion.span>
      <motion.small variants={rise} initial="hidden" animate="visible">your workspace is ready</motion.small>
    </motion.section>
  );
}

function AboutApp({ openApp }: { openApp: (id: AppId) => void }) {
  return (
    <ScrollPane>
      <motion.div className="about-app" variants={stagger} initial="hidden" animate="visible">
        <motion.div className="about-avatar" variants={staggerItem}>M</motion.div>
        <motion.div className="about-copy" variants={staggerItem}>
          <p className="app-kicker">{portfolio.location}</p>
          <h1>{portfolio.name}</h1>
          <p>{portfolio.summary}</p>
          <div className="about-actions">
            <motion.button
              className="xp-control primary"
              type="button"
              onClick={() => openApp("projects")}
              whileTap={press}
              transition={motionTransition.micro}
            >
              Browse projects
            </motion.button>
            <motion.button
              className="xp-control"
              type="button"
              onClick={() => openApp("demos")}
              whileTap={press}
              transition={motionTransition.micro}
            >
              Watch proof
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
      <motion.div className="about-proof" variants={stagger} initial="hidden" animate="visible">
        {[
          [String(githubProjects.repos.length), "repositories"],
          [`${(githubProjects.totalTokens / 1e6).toFixed(1)}M`, "code tokens"],
          [String(portfolio.videos.length), "product demos"],
        ].map(([value, label]) => (
          <motion.div key={label} variants={staggerItem}>
            <strong>{value}</strong>
            <span>{label}</span>
          </motion.div>
        ))}
      </motion.div>
      <motion.div className="focus-grid" variants={stagger} initial="hidden" animate="visible">
        {portfolio.focus.map((item) => <motion.span key={item} variants={staggerItem}>{item}</motion.span>)}
      </motion.div>
      <motion.section className="xp-document" variants={rise} initial="hidden" animate="visible">
        <h2>What I build</h2>
        <p>
          I work where product, Move contracts, and agent tooling meet. The through-line is shipping demos that
          feel real enough for a technical buyer to use, test, and critique.
        </p>
        <p>
          Most of the work here is Aptos-focused: markets, transaction composition, content rewards, trading agents,
          and infrastructure that helps teams understand what the chain can actually do.
        </p>
        <p className="about-colophon">MaxXP is a working portfolio: live APIs, production links, and screen recordings—not mockups.</p>
      </motion.section>
    </ScrollPane>
  );
}

function ResumeApp() {
  return (
    <ScrollPane>
      <motion.div className="resume-app" variants={stagger} initial="hidden" animate="visible">
        <motion.aside className="resume-sidebar" variants={staggerItem}>
          <img src={`${xp}/gui/desktop/resume.webp`} alt="" />
          <strong>{portfolio.name}</strong>
          <span>{portfolio.title}</span>
          <motion.a
            className="xp-control primary"
            href={portfolio.links.resume}
            target="_blank"
            rel="noreferrer"
            whileTap={press}
            transition={motionTransition.micro}
          >
            Open PDF
          </motion.a>
        </motion.aside>
        <motion.section className="resume-sheet" variants={staggerItem}>
          <h1>{portfolio.name}</h1>
          <p>{portfolio.summary}</p>
          <h2>Experience</h2>
          {portfolio.roles.map((role) => (
            <motion.article className="resume-role" key={`${role.company}-${role.period}`} variants={staggerItem}>
              <div>
                <strong>{role.company}</strong>
                <span>{role.period}</span>
              </div>
              <h3>{role.title}</h3>
              <p>{role.impact}</p>
            </motion.article>
          ))}
        </motion.section>
      </motion.div>
    </ScrollPane>
  );
}

function formatCodeTokens(tokens: number) {
  if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(2)}M`;
  if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(0)}K`;
  return `${tokens}`;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const normalized = query.trim();
  if (!normalized) return text;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pieces = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <>
      {pieces.map((piece, index) =>
        piece.toLowerCase() === normalized.toLowerCase() ? <mark key={`${piece}-${index}`}>{piece}</mark> : piece,
      )}
    </>
  );
}

function AllReposView() {
  const { repos, totalTokens, generatedAt } = githubProjects;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "public" | "private" | "seam">("all");
  const [visibleLimit, setVisibleLimit] = useState(24);
  const deferredQuery = useDeferredValue(query);
  const compact = useMediaQuery("(max-width: 56.25rem)");
  const visibleRepos = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return repos.filter((repo) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "live" && Boolean(repo.homepage)) ||
        (filter === "public" && !repo.private) ||
        (filter === "private" && repo.private) ||
        (filter === "seam" && repo.owner === "seammoney");
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;
      return [repo.owner, repo.name, repo.description, repo.language]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [deferredQuery, filter, repos]);

  useEffect(() => setVisibleLimit(24), [deferredQuery, filter]);

  const filters = [
    { id: "all", label: "All" },
    { id: "live", label: "Live" },
    { id: "public", label: "Public" },
    { id: "private", label: "Private" },
    { id: "seam", label: "Seam" },
  ] as const;

  return (
    <div className="repo-explorer">
      <div className="repo-tools">
        <label className="repo-search">
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${repos.length} repositories`}
          />
        </label>
        <LayoutGroup id="repo-filters">
        <div className="repo-filters" aria-label="Filter repositories">
          {filters.map((option) => (
            <motion.button
              key={option.id}
              type="button"
              className={cn(filter === option.id && "is-active")}
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
              whileTap={press}
              transition={motionTransition.micro}
            >
              {filter === option.id ? (
                <motion.span className="repo-filter-active" layoutId="repo-filter-active" transition={motionTransition.spatial} />
              ) : null}
              <span>{option.label}</span>
            </motion.button>
          ))}
        </div>
        </LayoutGroup>
        <span className="repo-result-count" aria-live="polite">
          {visibleRepos.length} shown
        </span>
      </div>
      {!compact ? (
      <ScrollPane className="repo-table-pane">
        <table className="repo-table" aria-label="GitHub repositories ranked by estimated code tokens">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code Tokens</th>
              <th>Live</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {visibleRepos.map((repo) => (
              <tr key={`${repo.owner}/${repo.name}`}>
                <td>
                  <span className="repo-name">
                    {repo.owner === "seammoney" ? <small>seam / </small> : null}
                    <HighlightedText text={repo.name} query={deferredQuery} />
                  </span>
                  {repo.private ? <em className="repo-tag">private</em> : null}
                  {repo.fork ? <em className="repo-tag">fork</em> : null}
                  {repo.archived ? <em className="repo-tag">archived</em> : null}
                </td>
                <td className="repo-tokens">{formatCodeTokens(repo.tokens)}</td>
                <td>
                  {repo.homepage ? (
                    <a href={repo.homepage} target="_blank" rel="noreferrer">
                      Open ↗
                    </a>
                  ) : (
                    <span className="repo-offline">—</span>
                  )}
                </td>
                <td className="repo-desc">
                  <HighlightedText text={repo.description ?? ""} query={deferredQuery} />
                </td>
              </tr>
            ))}
            {visibleRepos.length === 0 ? (
              <tr>
                <td className="repo-empty" colSpan={4}>
                  No repositories match this search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </ScrollPane>
      ) : null}
      {compact ? (
      <ScrollPane className="repo-mobile-pane">
        <motion.div className="repo-card-list" variants={stagger} initial="hidden" animate="visible" key={`${filter}-${deferredQuery}`}>
          {visibleRepos.slice(0, visibleLimit).map((repo) => (
            <motion.article className="repo-card" key={`${repo.owner}/${repo.name}`} variants={staggerItem} layout="position">
              <header>
                <div>
                  <small>{repo.owner === "seammoney" ? "SEAMMONEY" : "MAXMONEYCASH"}</small>
                  <h3><HighlightedText text={repo.name} query={deferredQuery} /></h3>
                </div>
                <strong>{formatCodeTokens(repo.tokens)}</strong>
              </header>
              <p><HighlightedText text={repo.description ?? "No description provided."} query={deferredQuery} /></p>
              <footer>
                <div className="repo-card-tags">
                  {repo.language ? <span>{repo.language}</span> : null}
                  {repo.private ? <span>Private</span> : <span>Public</span>}
                  {repo.fork ? <span>Fork</span> : null}
                </div>
                {repo.homepage ? (
                  <motion.a
                    href={repo.homepage}
                    target="_blank"
                    rel="noreferrer"
                    whileTap={press}
                    transition={motionTransition.micro}
                  >
                    Open live ↗
                  </motion.a>
                ) : null}
              </footer>
            </motion.article>
          ))}
          {visibleRepos.length === 0 ? (
            <motion.div className="repo-empty-card" variants={staggerItem}>
              <strong>No matching repositories</strong>
              <p>Change the search or return to the complete repository index.</p>
              <motion.button
                type="button"
                className="xp-control"
                onClick={() => { setQuery(""); setFilter("all"); }}
                whileTap={press}
                transition={motionTransition.micro}
              >
                Clear filters
              </motion.button>
            </motion.div>
          ) : null}
          {visibleLimit < visibleRepos.length ? (
            <motion.button
              type="button"
              className="repo-load-more"
              onClick={() => setVisibleLimit((current) => current + 24)}
              whileTap={press}
              transition={motionTransition.micro}
            >
              Show 24 more <span>{visibleRepos.length - visibleLimit} remaining</span>
            </motion.button>
          ) : null}
        </motion.div>
      </ScrollPane>
      ) : null}
      <p className="repo-footer">
        {githubProjects.repos.length} repositories · ~{(totalTokens / 1e6).toFixed(1)}M tokens of code · refreshed{" "}
        {new Date(generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}

function ProjectsApp() {
  const [view, setView] = useState<"featured" | "all">("featured");
  const [selectedProjectName, setSelectedProjectName] = useState(portfolio.projects[0]?.name ?? "");
  const selectedProject = portfolio.projects.find((project) => project.name === selectedProjectName) ?? portfolio.projects[0];

  if (!selectedProject) return null;

  return (
    <div className="projects-shell">
      <LayoutGroup id="project-views">
      <div className="projects-views" role="tablist">
        <motion.button
          type="button"
          role="tab"
          aria-selected={view === "featured"}
          className={cn(view === "featured" && "is-active")}
          onClick={() => setView("featured")}
          whileTap={press}
          transition={motionTransition.micro}
        >
          {view === "featured" ? <motion.span className="projects-view-active" layoutId="projects-view-active" /> : null}
          <span>Featured</span>
        </motion.button>
        <motion.button
          type="button"
          role="tab"
          aria-selected={view === "all"}
          className={cn(view === "all" && "is-active")}
          onClick={() => setView("all")}
          whileTap={press}
          transition={motionTransition.micro}
        >
          {view === "all" ? <motion.span className="projects-view-active" layoutId="projects-view-active" /> : null}
          <span>All repos <b>{githubProjects.repos.length}</b></span>
        </motion.button>
      </div>
      </LayoutGroup>
      <AnimatePresence mode="wait" initial={false}>
      {view === "all" ? (
        <motion.div className="projects-view-panel" key="all" variants={fadeThrough} initial="hidden" animate="visible" exit="exit">
          <AllReposView />
        </motion.div>
      ) : (
    <motion.div className="projects-app" key="featured" variants={fadeThrough} initial="hidden" animate="visible" exit="exit">
      <ScrollPane className="projects-list-pane">
        <div className="project-list">
          {portfolio.projects.map((project) => (
            <motion.button
              className={cn("project-row", selectedProject.name === project.name && "is-selected")}
              key={project.name}
              type="button"
              onClick={() => setSelectedProjectName(project.name)}
              whileTap={press}
              transition={motionTransition.micro}
            >
              {selectedProject.name === project.name ? (
                <motion.span className="project-row-active" layoutId="project-row-active" transition={motionTransition.spatial} />
              ) : null}
              <span className="project-thumb">{project.name.slice(0, 1)}</span>
              <span>
                <strong>{project.name}</strong>
                <small>{project.stack}</small>
              </span>
            </motion.button>
          ))}
        </div>
      </ScrollPane>
      <ScrollPane className="project-detail-pane">
        <AnimatePresence mode="wait" initial={false}>
        <motion.article
          className="project-detail"
          key={selectedProject.name}
          initial={{ opacity: 0, transform: "translate3d(8px, 0, 0)" }}
          animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
          exit={{ opacity: 0, transform: "translate3d(-6px, 0, 0)" }}
          transition={motionTransition.short}
        >
          <div className="project-hero">
            <span>{selectedProject.name.slice(0, 2)}</span>
          </div>
          <p className="app-kicker">{selectedProject.stack}</p>
          <h1>{selectedProject.name}</h1>
          <p>{selectedProject.summary}</p>
          {selectedProject.link ? (
            <motion.a
              className="xp-control primary"
              href={selectedProject.link}
              target="_blank"
              rel="noreferrer"
              whileTap={press}
              transition={motionTransition.micro}
            >
              Open {externalLabel(selectedProject.link)}
            </motion.a>
          ) : null}
        </motion.article>
        </AnimatePresence>
      </ScrollPane>
    </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

function ContactApp() {
  return (
    <ScrollPane>
      <motion.section className="contact-app" variants={stagger} initial="hidden" animate="visible">
        <motion.div className="contact-intro" variants={staggerItem}>
          <span>START A CONVERSATION</span>
          <h1>Send the hard part.</h1>
          <p>Move systems, trading infrastructure, transaction composition, agent tooling, or a product demo that needs to feel real.</p>
        </motion.div>
        <motion.div className="mail-header" variants={staggerItem}>
          <span>To:</span>
          <a href={portfolio.links.email}>maxwell.mohammadi@gmail.com</a>
        </motion.div>
        <motion.div className="mail-header" variants={staggerItem}>
          <span>Subject:</span>
          <strong>Aptos product / agent infrastructure</strong>
        </motion.div>
        <motion.textarea
          readOnly
          value={
            "Send context on the protocol, product, or workflow you want to ship. Email is the fastest way to reach me.\n\nI can help with Move systems, demo infrastructure, transaction composition, onchain trading flows, and agent tooling."
          }
          variants={staggerItem}
        />
        <motion.div className="contact-actions" variants={staggerItem}>
          <motion.a className="xp-control primary" href={portfolio.links.email} whileTap={press} transition={motionTransition.micro}>
            Send Message
          </motion.a>
          <motion.a className="xp-control" href={portfolio.links.github} target="_blank" rel="noreferrer" whileTap={press} transition={motionTransition.micro}>
            GitHub
          </motion.a>
          <motion.a className="xp-control" href={portfolio.links.linkedin} target="_blank" rel="noreferrer" whileTap={press} transition={motionTransition.micro}>
            LinkedIn
          </motion.a>
        </motion.div>
      </motion.section>
    </ScrollPane>
  );
}

function WindowChrome({
  record,
  active,
  children,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onDragStart,
  onResizeStart,
  isInteracting,
  openApp,
  crtEnabled,
  onToggleCrt,
}: {
  record: WindowRecord;
  active: boolean;
  children: ReactNode;
  onFocus: (id: AppId) => void;
  onClose: (id: AppId) => void;
  onMinimize: (id: AppId) => void;
  onMaximize: (id: AppId) => void;
  onDragStart: (event: ReactPointerEvent, record: WindowRecord) => void;
  onResizeStart: (event: ReactPointerEvent, record: WindowRecord) => void;
  isInteracting: boolean;
  openApp: (id: AppId) => void;
  crtEnabled: boolean;
  onToggleCrt: () => void;
}) {
  const app = appCatalog[record.id];
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const [minimizeVector, setMinimizeVector] = useState({ x: 0, y: 48 });
  const style = record.maximized
    ? { zIndex: record.z }
    : { left: record.x, top: record.y, width: record.width, height: record.height, zIndex: record.z };

  const handleMinimize = () => {
    const element = sectionRef.current;
    const taskbarButton = document.querySelector<HTMLElement>(`[data-taskbar-app="${record.id}"]`);
    const windowRect = element?.getBoundingClientRect();
    const taskbarRect = taskbarButton?.getBoundingClientRect();
    const x = windowRect && taskbarRect ? taskbarRect.left + taskbarRect.width / 2 - (windowRect.left + windowRect.width / 2) : 0;
    const y = windowRect && taskbarRect ? taskbarRect.top + taskbarRect.height / 2 - (windowRect.top + windowRect.height / 2) : 46;
    setMinimizeVector({ x, y });
    onMinimize(record.id);
  };

  const handleMaximize = () => onMaximize(record.id);

  const windowMotion = record.minimized
    ? {
        opacity: 0,
        transform: reduceMotion
          ? "translate3d(0, 0, 0) scale(1)"
          : `translate3d(${minimizeVector.x}px, ${minimizeVector.y}px, 0) scale(0.18)`,
        transitionEnd: { visibility: "hidden" as const },
      }
    : {
        opacity: 1,
        transform: "translate3d(0, 0, 0) scale(1)",
        visibility: "visible" as const,
      };

  const menus: WindowMenu[] = [
    {
      label: "File",
      items: [
        { label: "New Window", disabled: true },
        { label: "Open Resume PDF", href: portfolio.links.resume },
        "separator",
        { label: "Close", onSelect: () => onClose(record.id) },
      ],
    },
    {
      label: "Edit",
      items: [
        {
          label: "Copy Email Address",
          onSelect: () => {
            void navigator.clipboard?.writeText(portfolio.links.email.replace(/^mailto:/, "")).catch(() => {});
          },
        },
        { label: "Select All", disabled: true },
      ],
    },
    {
      label: "View",
      items: [
        { label: "CRT Effects", checked: crtEnabled, onSelect: onToggleCrt },
        { label: "Full Screen", onSelect: () => document.documentElement.requestFullscreen?.() },
        "separator",
        { label: record.maximized ? "Restore" : "Maximize", onSelect: handleMaximize },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "About Max", onSelect: () => openApp("about") },
        "separator",
        { label: "GitHub", href: portfolio.links.github },
        { label: "LinkedIn", href: portfolio.links.linkedin },
      ],
    },
  ];

  return (
    <motion.section
      ref={sectionRef}
      className={cn(
        "xp-window",
        active && "is-active",
        record.maximized && "is-maximized",
        record.minimized && "is-minimized",
      )}
      style={style}
      aria-label={app.title}
      aria-hidden={record.minimized}
      inert={record.minimized}
      onPointerDown={() => onFocus(record.id)}
      layout={!isInteracting}
      initial={{ opacity: 0, transform: "translate3d(0, 10px, 0) scale(0.97)" }}
      animate={windowMotion}
      exit={{ opacity: 0, transform: "translate3d(0, 6px, 0) scale(0.96)" }}
      transition={reduceMotion ? { duration: 0.15 } : motionTransition.spatial}
    >
      <header
        className="window-titlebar"
        onPointerDown={(event) => onDragStart(event, record)}
        onDoubleClick={(event) => {
          if ((event.target as Element).closest(".window-buttons")) return;
          handleMaximize();
        }}
      >
        <div className="titlebar-title">
          <img src={app.icon} alt="" draggable={false} />
          <strong>{app.title}</strong>
        </div>
        <div className="window-buttons" onPointerDown={(event) => event.stopPropagation()}>
          <Tooltip label="Minimize">
            <motion.button
              type="button"
              aria-label={`Minimize ${app.title}`}
              onClick={handleMinimize}
              whileTap={press}
              transition={motionTransition.micro}
            >
              _
            </motion.button>
          </Tooltip>
          <Tooltip label={record.maximized ? "Restore Down" : "Maximize"}>
            <motion.button
              type="button"
              aria-label={`${record.maximized ? "Restore" : "Maximize"} ${app.title}`}
              onClick={handleMaximize}
              whileTap={press}
              transition={motionTransition.micro}
            >
              □
            </motion.button>
          </Tooltip>
          <Tooltip label="Close">
            <motion.button
              type="button"
              aria-label={`Close ${app.title}`}
              onClick={() => onClose(record.id)}
              whileTap={press}
              transition={motionTransition.micro}
            >
              ×
            </motion.button>
          </Tooltip>
        </div>
      </header>
      <MenuBar menus={menus} ariaLabel={`${app.title} menu`} />
      <div className="window-toolbar">
        <motion.button type="button" onClick={() => openApp("projects")} whileTap={press} transition={motionTransition.micro}>
          <img src={appCatalog.projects.icon} alt="" />
          Projects
        </motion.button>
        <motion.button type="button" onClick={() => openApp("demos")} whileTap={press} transition={motionTransition.micro}>
          <img src={appCatalog.demos.icon} alt="" />
          Demos
        </motion.button>
        <motion.button type="button" onClick={() => openApp("stats")} whileTap={press} transition={motionTransition.micro}>
          <img src={appCatalog.stats.icon} alt="" />
          Stats
        </motion.button>
        <motion.button type="button" onClick={() => openApp("contact")} whileTap={press} transition={motionTransition.micro}>
          <img src={appCatalog.contact.icon} alt="" />
          Contact
        </motion.button>
      </div>
      <div className="address-bar">
        <span>Address</span>
        <div>
          <img src={app.icon} alt="" />
          maxxp://{record.id}
        </div>
      </div>
      <div className="window-content">{children}</div>
      <footer className="window-status">{app.status}</footer>
      {!record.maximized ? (
        <motion.button
          className="resize-handle"
          type="button"
          aria-label={`Resize ${app.title}`}
          onPointerDown={(event) => onResizeStart(event, record)}
          whileTap={press}
          transition={motionTransition.micro}
        />
      ) : null}
    </motion.section>
  );
}

function StartMenu({
  open,
  openApp,
  onClose,
  onLogOff,
}: {
  open: boolean;
  openApp: (id: AppId) => void;
  onClose: () => void;
  onLogOff: () => void;
}) {
  const menuRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (menuRef.current?.contains(target) || target.closest(".start-button")) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".start-button")?.focus());
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
    {open ? (
    <motion.aside
      ref={menuRef}
      id="maxxp-start-menu"
      className="start-menu"
      aria-label="Start menu"
      variants={sheet}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <span className="start-menu-handle" aria-hidden="true" />
      <header className="start-menu-header">
        <span className="start-avatar">M</span>
        <span>
          <strong>{portfolio.name}</strong>
          <small>MaxXP workspace</small>
        </span>
      </header>
      <div className="start-menu-body">
        <motion.div className="start-menu-left" variants={quickStagger} initial="hidden" animate="visible">
          {(["projects", "stats", "contact", "about", "resume", "demos"] as AppId[]).map((id) => (
            <motion.button
              key={id}
              type="button"
              onClick={() => openApp(id)}
              variants={quickItem}
              whileTap={press}
              transition={motionTransition.micro}
            >
              <img src={appCatalog[id].icon} alt="" />
              <span>
                <strong>{appCatalog[id].title}</strong>
                <small>{appCatalog[id].status}</small>
              </span>
            </motion.button>
          ))}
        </motion.div>
        <motion.div className="start-menu-right" variants={quickStagger} initial="hidden" animate="visible">
          <motion.a href={portfolio.links.github} target="_blank" rel="noreferrer" variants={quickItem} whileTap={press}>
            <img src={`${xp}/gui/start-menu/github.webp`} alt="" />
            GitHub
          </motion.a>
          <motion.a href={portfolio.links.linkedin} target="_blank" rel="noreferrer" variants={quickItem} whileTap={press}>
            <img src={`${xp}/gui/start-menu/linkedin.webp`} alt="" />
            LinkedIn
          </motion.a>
          <motion.button type="button" onClick={() => openApp("resume")} variants={quickItem} whileTap={press}>
            <img src={`${xp}/gui/start-menu/recently-used.webp`} alt="" />
            Open resume
          </motion.button>
          <motion.button type="button" onClick={() => openApp("demos")} variants={quickItem} whileTap={press}>
            <img src={`${xp}/gui/start-menu/mediaPlayer.webp`} alt="" />
            Watch demos
          </motion.button>
        </motion.div>
      </div>
      <footer className="start-menu-footer">
        <motion.button type="button" onClick={onLogOff} whileTap={press} transition={motionTransition.micro}>
          <img src={`${xp}/gui/start-menu/logoff.webp`} alt="" />
          Log Off
        </motion.button>
        <motion.button type="button" onClick={onLogOff} whileTap={press} transition={motionTransition.micro}>
          <img src={`${xp}/gui/start-menu/shutdown.webp`} alt="" />
          Shut Down
        </motion.button>
      </footer>
    </motion.aside>
    ) : null}
    </AnimatePresence>
  );
}

type CommandItem = {
  id: string;
  label: string;
  description: string;
  icon: string;
  run: () => void;
};

const commandBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: (instant: boolean) => ({
    opacity: 1,
    transition: instant ? { duration: 0 } : motionTransition.short,
  }),
  exit: (instant: boolean) => ({
    opacity: 0,
    transition: instant ? { duration: 0 } : motionTransition.short,
  }),
};

const commandSheetVariants: Variants = {
  hidden: { opacity: 0, transform: "translate3d(0, 24px, 0) scale(0.985)" },
  visible: (instant: boolean) => ({
    opacity: 1,
    transform: "translate3d(0, 0, 0) scale(1)",
    transition: instant ? { duration: 0 } : motionTransition.spatial,
  }),
  exit: (instant: boolean) => ({
    opacity: 0,
    transform: "translate3d(0, 16px, 0) scale(0.99)",
    transition: instant ? { duration: 0 } : motionTransition.exit,
  }),
};

function CommandPalette({
  open,
  instant,
  onClose,
  openApp,
}: {
  open: boolean;
  instant: boolean;
  onClose: (instant?: boolean) => void;
  openApp: (id: AppId) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);
  const commands = useMemo<CommandItem[]>(
    () => [
      ...desktopApps.map((id) => ({
        id,
        label: appCatalog[id].title,
        description: appCatalog[id].status,
        icon: appCatalog[id].icon,
        run: () => openApp(id),
      })),
      {
        id: "email",
        label: "Email Max",
        description: "Start a project conversation",
        icon: appCatalog.contact.icon,
        run: () => { window.location.href = portfolio.links.email; },
      },
      {
        id: "github",
        label: "Open GitHub",
        description: "Browse public work on GitHub",
        icon: `${xp}/gui/start-menu/github.webp`,
        run: () => window.open(portfolio.links.github, "_blank", "noopener,noreferrer"),
      },
    ],
    [openApp],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) => `${command.label} ${command.description}`.toLowerCase().includes(needle));
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setSelectedIndex(0);
    setKeyboardNavigation(false);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose(true);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = inputRef.current?.closest<HTMLElement>(".command-palette");
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleDialogKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [onClose, open]);

  useEffect(() => setSelectedIndex(0), [query]);

  const run = (command?: CommandItem, instantClose = false) => {
    if (!command) return;
    command.run();
    onClose(instantClose);
  };

  return (
    <AnimatePresence custom={instant}>
      {open ? (
        <motion.div
          className="command-backdrop"
          custom={instant}
          variants={commandBackdropVariants}
          initial={instant ? false : "hidden"}
          animate="visible"
          exit="exit"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onClose(false);
          }}
        >
          <motion.section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Open an app or link"
            custom={instant}
            variants={commandSheetVariants}
            initial={instant ? false : "hidden"}
            animate="visible"
            exit="exit"
          >
            <header className="command-search">
              <span aria-hidden="true">›_</span>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => {
                  setKeyboardNavigation(true);
                  setQuery(event.target.value);
                }}
                placeholder="Open an app or search MaxXP"
                aria-label="Search commands"
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setKeyboardNavigation(true);
                    setSelectedIndex((current) => Math.min(filtered.length - 1, current + 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setKeyboardNavigation(true);
                    setSelectedIndex((current) => Math.max(0, current - 1));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    run(filtered[selectedIndex], true);
                  } else if (event.key === "Escape") {
                    onClose(true);
                  }
                }}
              />
              <kbd>ESC</kbd>
            </header>
            <motion.div
              className="command-results"
              variants={quickStagger}
              initial={instant ? false : "hidden"}
              animate="visible"
            >
              {filtered.map((command, index) => (
                <motion.button
                  key={command.id}
                  type="button"
                  className={cn(index === selectedIndex && "is-selected")}
                  onPointerEnter={() => {
                    setKeyboardNavigation(false);
                    setSelectedIndex(index);
                  }}
                  onClick={() => run(command, false)}
                  variants={quickItem}
                  whileTap={press}
                  transition={motionTransition.micro}
                >
                  {index === selectedIndex ? (
                    <motion.span
                      className="command-selection"
                      layoutId="command-selection"
                      transition={keyboardNavigation ? { duration: 0 } : motionTransition.spatial}
                    />
                  ) : null}
                  <img src={command.icon} alt="" />
                  <span>
                    <strong>{command.label}</strong>
                    <small>{command.description}</small>
                  </span>
                  <kbd>↵</kbd>
                </motion.button>
              ))}
              {filtered.length === 0 ? (
                <motion.div className="command-empty" variants={quickItem}>
                  <strong>No matching action</strong>
                  <span>Try “projects”, “resume”, or “GitHub”.</span>
                </motion.div>
              ) : null}
            </motion.div>
            <footer className="command-footer">
              <span>↑↓ navigate</span><span>↵ open</span><span>⌘K toggle</span>
            </footer>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function MobileHome({ openApp }: { openApp: (id: AppId) => void }) {
  return (
    <motion.section className="mobile-home" variants={stagger} initial="hidden" animate="visible">
      <motion.header variants={staggerItem}>
        <span>MAXXP / PORTFOLIO</span>
        <h1>Work you can open, watch, and inspect.</h1>
        <p>{portfolio.summary}</p>
      </motion.header>
      <motion.div className="mobile-home-grid" variants={stagger}>
        {desktopApps.map((id) => (
          <motion.button
            key={id}
            type="button"
            onClick={() => openApp(id)}
            variants={staggerItem}
            whileTap={press}
            transition={motionTransition.micro}
          >
            <img src={appCatalog[id].icon} alt="" />
            <span><strong>{appCatalog[id].shortTitle}</strong><small>{appCatalog[id].status}</small></span>
          </motion.button>
        ))}
      </motion.div>
      <motion.p className="mobile-colophon" variants={staggerItem}>
        {githubProjects.repos.length} repositories · {(githubProjects.totalTokens / 1e6).toFixed(1)}M estimated code tokens · {portfolio.location}
      </motion.p>
    </motion.section>
  );
}

function App() {
  const [phase, setPhase] = useState<BootPhase>("boot");
  const [startOpen, setStartOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandInstant, setCommandInstant] = useState(false);
  const [crtEnabled, setCrtEnabled] = useState(readCrtPreference);
  const [showWelcome, setShowWelcome] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [windows, setWindows] = useState<WindowRecord[]>([
    { id: "about", x: 168, y: 78, width: 790, height: 650, z: 2, minimized: false, maximized: false },
  ]);
  const [activeWindow, setActiveWindow] = useState<AppId | null>("about");
  const [drag, setDrag] = useState<DragState | null>(null);
  const zRef = useRef(3);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase("login"), reduceMotion ? 350 : 1800);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    if (phase !== "welcome") return;
    const timer = window.setTimeout(() => setPhase("desktop"), 720);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setStartOpen(false);
        setCommandInstant(true);
        setCommandOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("maxxp:crt", crtEnabled ? "on" : "off");
    } catch {
      // Storage is optional; the toggle still works for the current visit.
    }
  }, [crtEnabled]);

  useEffect(() => {
    if (phase !== "desktop") return;
    const show = window.setTimeout(() => setShowWelcome(true), 1400);
    const hide = window.setTimeout(() => setShowWelcome(false), 12000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [phase]);

  useEffect(() => {
    if (showWelcome) playSound("balloon");
  }, [showWelcome]);

  useEffect(() => {
    if (activeWindow && windows.some((windowRecord) => windowRecord.id === activeWindow && !windowRecord.minimized)) return;
    const next = [...windows]
      .filter((windowRecord) => !windowRecord.minimized)
      .sort((a, b) => b.z - a.z)[0];
    setActiveWindow(next?.id ?? null);
  }, [activeWindow, windows]);

  useEffect(() => {
    if (!drag) return;

    const handleMove = (event: PointerEvent) => {
      setWindows((current) =>
        current.map((windowRecord) => {
          if (windowRecord.id !== drag.id) return windowRecord;
          if (drag.mode === "move") {
            return {
              ...windowRecord,
              x: Math.max(0, Math.min(window.innerWidth - 180, drag.originX + event.clientX - drag.startX)),
              y: Math.max(0, Math.min(window.innerHeight - 80, drag.originY + event.clientY - drag.startY)),
            };
          }
          const app = appCatalog[windowRecord.id];
          const maxWidth = Math.max(app.dimensions.minWidth, window.innerWidth - windowRecord.x - 8);
          const maxHeight = Math.max(app.dimensions.minHeight, window.innerHeight - windowRecord.y - 39);
          return {
            ...windowRecord,
            width: Math.min(maxWidth, Math.max(app.dimensions.minWidth, drag.width + event.clientX - drag.startX)),
            height: Math.min(maxHeight, Math.max(app.dimensions.minHeight, drag.height + event.clientY - drag.startY)),
          };
        }),
      );
    };

    const stopDrag = () => setDrag(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopDrag, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopDrag);
    };
  }, [drag]);

  const focusWindow = useCallback((id: AppId) => {
    setActiveWindow(id);
    setWindows((current) =>
      current.map((windowRecord) =>
        windowRecord.id === id ? { ...windowRecord, z: ++zRef.current, minimized: false } : windowRecord,
      ),
    );
  }, []);

  const closeStartMenu = useCallback(() => setStartOpen(false), []);
  const closeCommandPalette = useCallback((instant = false) => {
    setCommandInstant(instant);
    setCommandOpen(false);
  }, []);
  const openCommandPalette = useCallback(() => {
    setCommandInstant(false);
    setStartOpen(false);
    setCommandOpen(true);
  }, []);

  const openApp = useCallback(
    (id: AppId) => {
      setStartOpen(false);
      setCommandInstant(false);
      setCommandOpen(false);
      setWindows((current) => {
        const existing = current.find((windowRecord) => windowRecord.id === id);
        if (existing) {
          return current.map((windowRecord) =>
            windowRecord.id === id ? { ...windowRecord, z: ++zRef.current, minimized: false } : windowRecord,
          );
        }
        const app = appCatalog[id];
        const offset = current.length * 24;
        const x = Math.max(8, Math.min(150 + offset, window.innerWidth - app.dimensions.width - 8));
        const y = Math.max(8, Math.min(72 + offset, window.innerHeight - app.dimensions.height - 39));
        return [
          ...current,
          {
            id,
            x,
            y,
            width: app.dimensions.width,
            height: app.dimensions.height,
            z: ++zRef.current,
            minimized: false,
            maximized: false,
          },
        ];
      });
      setActiveWindow(id);
    },
    [],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
      return;
    }
    void document.documentElement.requestFullscreen?.();
  }, []);

  const login = () => {
    setPhase("welcome");
    playSound("login");
  };

  const logOff = () => {
    playSound("logoff");
    setStartOpen(false);
    setCommandInstant(true);
    setCommandOpen(false);
    setShowWelcome(false);
    setPhase("login");
  };

  const closeWindow = (id: AppId) => {
    setWindows((current) => current.filter((windowRecord) => windowRecord.id !== id));
    setStartOpen(false);
  };

  const minimizeWindow = (id: AppId) => {
    setWindows((current) =>
      current.map((windowRecord) => (windowRecord.id === id ? { ...windowRecord, minimized: true } : windowRecord)),
    );
  };

  const maximizeWindow = (id: AppId) => {
    setWindows((current) =>
      current.map((windowRecord) =>
        windowRecord.id === id ? { ...windowRecord, maximized: !windowRecord.maximized, z: ++zRef.current } : windowRecord,
      ),
    );
    setActiveWindow(id);
  };

  const startDrag = (event: ReactPointerEvent, record: WindowRecord) => {
    if (record.maximized) return;
    event.preventDefault();
    setDrag({ mode: "move", id: record.id, startX: event.clientX, startY: event.clientY, originX: record.x, originY: record.y });
    focusWindow(record.id);
  };

  const startResize = (event: ReactPointerEvent, record: WindowRecord) => {
    event.preventDefault();
    event.stopPropagation();
    setDrag({ mode: "resize", id: record.id, startX: event.clientX, startY: event.clientY, width: record.width, height: record.height });
    focusWindow(record.id);
  };

  const contentForWindow = (windowRecord: WindowRecord) => {
    switch (windowRecord.id) {
      case "about":
        return <AboutApp openApp={openApp} />;
      case "resume":
        return <ResumeApp />;
      case "projects":
        return <ProjectsApp />;
      case "demos":
        return <ReelsApp active={!windowRecord.minimized} />;
      case "contact":
        return <ContactApp />;
      case "stats":
        return <StatsApp />;
    }
  };

  const activeTitle = activeWindow ? appCatalog[activeWindow].shortTitle : "Home";

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        {phase === "boot" ? <BootScreen key="boot" /> : null}
        {phase === "login" ? <LoginScreen key="login" onLogin={login} /> : null}
        {phase === "welcome" ? <WelcomeScreen key="welcome" /> : null}
        {phase === "desktop" ? (
          <motion.main
            key="desktop"
            className={cn("maxxp-desktop", crtEnabled && "crt-on")}
            initial={{ opacity: 0, transform: "translate3d(0, 2px, 0) scale(0.998)" }}
            animate={{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }}
            exit={{ opacity: 0, transform: "translate3d(0, -1px, 0) scale(0.999)" }}
            transition={motionTransition.short}
          >
            <motion.div
              className="maxxp-wallpaper"
              aria-hidden="true"
              initial={
                reduceMotion
                  ? { transform: "translate3d(0, 0, 0) scale(1.025)" }
                  : { transform: "translate3d(-0.35%, -0.2%, 0) scale(1.045)" }
              }
              animate={
                { transform: "translate3d(0, 0, 0) scale(1.025)" }
              }
              transition={reduceMotion ? { duration: 0 } : { duration: 1.2, ease: easeOut }}
            />

            <header className="mobile-shell-header">
              <span className="mobile-wordmark">MaxXP</span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.strong
                  key={activeTitle}
                  initial={{ opacity: 0, transform: "translate3d(0, 4px, 0)" }}
                  animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
                  exit={{ opacity: 0, transform: "translate3d(0, -4px, 0)" }}
                  transition={motionTransition.micro}
                >
                  {activeTitle}
                </motion.strong>
              </AnimatePresence>
              <motion.button
                type="button"
                aria-label="Open command palette"
                onClick={openCommandPalette}
                whileTap={press}
                transition={motionTransition.micro}
              >
                ⌘K
              </motion.button>
            </header>

            <MobileHome openApp={openApp} />

            <motion.section
              className="desktop-icons"
              id="desktop-icons"
              aria-label="Desktop applications"
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              {desktopApps.map((id) => (
                <motion.button
                  key={id}
                  className="desktop-icon"
                  type="button"
                  onClick={() => openApp(id)}
                  variants={staggerItem}
                  whileTap={press}
                  transition={motionTransition.micro}
                >
                  <img src={appCatalog[id].icon} alt="" draggable={false} />
                  <span>{appCatalog[id].desktopLabel}</span>
                </motion.button>
              ))}
            </motion.section>

            <div className="windows-layer">
              <AnimatePresence initial={false}>
                {windows
                  .slice()
                  .sort((a, b) => a.z - b.z)
                  .map((windowRecord) => (
                    <WindowChrome
                      key={windowRecord.id}
                      record={windowRecord}
                      active={activeWindow === windowRecord.id}
                      onFocus={focusWindow}
                      onClose={closeWindow}
                      onMinimize={minimizeWindow}
                      onMaximize={maximizeWindow}
                      onDragStart={startDrag}
                      onResizeStart={startResize}
                      isInteracting={drag?.id === windowRecord.id}
                      openApp={openApp}
                      crtEnabled={crtEnabled}
                      onToggleCrt={() => setCrtEnabled((value) => !value)}
                    >
                      {contentForWindow(windowRecord)}
                    </WindowChrome>
                  ))}
              </AnimatePresence>
            </div>

            <StartMenu open={startOpen} openApp={openApp} onClose={closeStartMenu} onLogOff={logOff} />

            <TrayBalloon title="Welcome to MaxXP" visible={showWelcome} onClose={() => setShowWelcome(false)}>
              Start with Demo Reel for product proof, then open Projects for the full repository index. Every surface is
              wired to real content.
            </TrayBalloon>

            <CommandPalette
              open={commandOpen}
              instant={commandInstant}
              onClose={closeCommandPalette}
              openApp={openApp}
            />

            <footer className="taskbar">
              <motion.button
                className={cn("start-button", startOpen && "is-active")}
                type="button"
                aria-expanded={startOpen}
                aria-controls="maxxp-start-menu"
                onClick={() => { closeCommandPalette(false); setStartOpen((value) => !value); }}
                whileTap={press}
                transition={motionTransition.micro}
              >
                <img src={`${xp}/gui/taskbar/start-button.webp`} alt="Start" />
                <span className="mobile-start-label">Apps</span>
              </motion.button>
              <ScrollPane className="taskbar-programs-scroll">
                <LayoutGroup id="taskbar-programs">
                <div className="taskbar-programs">
                  {windows.map((windowRecord) => {
                    const isActive = activeWindow === windowRecord.id && !windowRecord.minimized;
                    return (
                    <motion.button
                      key={windowRecord.id}
                      data-taskbar-app={windowRecord.id}
                      className={cn(isActive && "is-active")}
                      type="button"
                      onClick={() => focusWindow(windowRecord.id)}
                      whileTap={press}
                      transition={motionTransition.micro}
                    >
                      {isActive ? <motion.span className="taskbar-active" layoutId="taskbar-active" /> : null}
                      <img src={appCatalog[windowRecord.id].icon} alt="" />
                      <span>{appCatalog[windowRecord.id].shortTitle}</span>
                    </motion.button>
                  )})}
                </div>
                </LayoutGroup>
              </ScrollPane>
              <nav className="mobile-dock" aria-label="Portfolio apps">
                <LayoutGroup id="mobile-dock">
                  {mobileDockApps.map((id) => {
                    const isActive = activeWindow === id && windows.some((record) => record.id === id && !record.minimized);
                    return (
                      <motion.button
                        key={id}
                        type="button"
                        className={cn(isActive && "is-active")}
                        aria-label={`Open ${appCatalog[id].title}`}
                        onClick={() => openApp(id)}
                        whileTap={press}
                        transition={motionTransition.micro}
                      >
                        {isActive ? <motion.span className="mobile-dock-active" layoutId="mobile-dock-active" /> : null}
                        <img src={appCatalog[id].icon} alt="" />
                        <span>{appCatalog[id].shortTitle}</span>
                      </motion.button>
                    );
                  })}
                </LayoutGroup>
              </nav>
              <div className="system-tray">
                <Tooltip label="Open command palette">
                  <motion.button type="button" aria-label="Open command palette" onClick={openCommandPalette} whileTap={press}>
                    <span className="tray-command">⌘K</span>
                  </motion.button>
                </Tooltip>
                <Tooltip label="Show welcome message">
                  <motion.button type="button" aria-label="Show welcome message" onClick={() => setShowWelcome((value) => !value)} whileTap={press}>
                    <img src={`${xp}/gui/taskbar/welcome.webp`} alt="" />
                  </motion.button>
                </Tooltip>
                <Tooltip label="Toggle CRT effects">
                  <motion.button type="button" aria-label="Toggle CRT effects" onClick={() => setCrtEnabled((value) => !value)} whileTap={press}>
                    <img src={`${xp}/gui/taskbar/crt.webp`} alt="" />
                  </motion.button>
                </Tooltip>
                <Tooltip label="Toggle full screen">
                  <motion.button type="button" aria-label="Toggle fullscreen mode" onClick={toggleFullscreen} whileTap={press}>
                    <img src={`${xp}/gui/taskbar/fullscreen.webp`} alt="" />
                  </motion.button>
                </Tooltip>
                <Tooltip label={now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}>
                  <time dateTime={now.toISOString()}>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                </Tooltip>
              </div>
            </footer>
            <div className="crt-scanline" aria-hidden="true" />
            <div className="crt-vignette" aria-hidden="true" />
          </motion.main>
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  );
}

export default App;
