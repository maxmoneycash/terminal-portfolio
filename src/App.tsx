import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { portfolio } from "./data/portfolio";
import githubProjects from "./data/github-projects.json";
import { cn } from "./lib/cn";
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
      <div className="scroll-edge scroll-edge-top" aria-hidden="true" />
      <div className="scroll-edge scroll-edge-right" aria-hidden="true" />
      <div className="scroll-edge scroll-edge-bottom" aria-hidden="true" />
      <div className="scroll-edge scroll-edge-left" aria-hidden="true" />
    </div>
  );
}

function BootScreen() {
  return (
    <section className="xp-boot-screen" aria-label="Booting MaxXP">
      <div className="boot-center">
        <div className="boot-logo-mark">MaxXP</div>
        <div className="boot-progress" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="boot-corner boot-left">For the best experience</div>
      <div className="boot-corner boot-right">Enter full screen</div>
    </section>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="xp-login-screen" aria-label="Log in">
      <div className="login-panel">
        <div className="login-brand">
          <span className="windows-flag" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <strong>
            Max<span>XP</span>
          </strong>
          <em>{portfolio.title}</em>
          <p>
            To begin, click on <span>{portfolio.handle}</span> to log in
          </p>
        </div>
        <div className="login-divider" />
        <button className="login-user" type="button" autoFocus onClick={onLogin}>
          <span className="login-avatar">M</span>
          <span>
            <strong>{portfolio.name}</strong>
            <small>{portfolio.title}</small>
          </span>
        </button>
      </div>
      <div className="login-footer-left">
        <span className="restart-dot" aria-hidden="true" />
        Restart MaxXP
      </div>
      <div className="login-footer-right">
        <span>After you log on, the system is yours to explore.</span>
        <span>Every window is wired to real portfolio content.</span>
      </div>
    </section>
  );
}

function WelcomeScreen() {
  return (
    <section className="xp-welcome-screen" aria-label="Welcome">
      <span>welcome</span>
      <small>loading your portfolio…</small>
    </section>
  );
}

function AboutApp({ openApp }: { openApp: (id: AppId) => void }) {
  return (
    <ScrollPane>
      <div className="about-app">
        <div className="about-avatar">M</div>
        <div className="about-copy">
          <p className="app-kicker">{portfolio.location}</p>
          <h1>{portfolio.name}</h1>
          <p>{portfolio.summary}</p>
          <div className="about-actions">
            <button className="xp-control primary" type="button" onClick={() => openApp("projects")}>
              My Projects
            </button>
            <button className="xp-control" type="button" onClick={() => openApp("demos")}>
              Watch Demos
            </button>
          </div>
        </div>
      </div>
      <div className="focus-grid">
        {portfolio.focus.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <section className="xp-document">
        <h2>What I build</h2>
        <p>
          I work where product, Move contracts, and agent tooling meet. The through-line is shipping demos that
          feel real enough for a technical buyer to use, test, and critique.
        </p>
        <p>
          Most of the work here is Aptos-focused: markets, transaction composition, content rewards, trading agents,
          and infrastructure that helps teams understand what the chain can actually do.
        </p>
      </section>
    </ScrollPane>
  );
}

function ResumeApp() {
  return (
    <ScrollPane>
      <div className="resume-app">
        <aside className="resume-sidebar">
          <img src={`${xp}/gui/desktop/resume.webp`} alt="" />
          <strong>{portfolio.name}</strong>
          <span>{portfolio.title}</span>
          <a className="xp-control primary" href={portfolio.links.resume} target="_blank" rel="noreferrer">
            Open PDF
          </a>
        </aside>
        <section className="resume-sheet">
          <h1>{portfolio.name}</h1>
          <p>{portfolio.summary}</p>
          <h2>Experience</h2>
          {portfolio.roles.map((role) => (
            <article className="resume-role" key={`${role.company}-${role.period}`}>
              <div>
                <strong>{role.company}</strong>
                <span>{role.period}</span>
              </div>
              <h3>{role.title}</h3>
              <p>{role.impact}</p>
            </article>
          ))}
        </section>
      </div>
    </ScrollPane>
  );
}

function formatCodeTokens(tokens: number) {
  if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(2)}M`;
  if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(0)}K`;
  return `${tokens}`;
}

function AllReposView() {
  const { repos, totalTokens, generatedAt } = githubProjects;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "public" | "private" | "seam">("all");
  const visibleRepos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
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
  }, [filter, query, repos]);

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
        <div className="repo-filters" aria-label="Filter repositories">
          {filters.map((option) => (
            <button
              key={option.id}
              type="button"
              className={cn(filter === option.id && "is-active")}
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="repo-result-count" aria-live="polite">
          {visibleRepos.length} shown
        </span>
      </div>
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
                    {repo.name}
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
                <td className="repo-desc">{repo.description ?? ""}</td>
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
      <div className="projects-views" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === "featured"}
          className={cn(view === "featured" && "is-active")}
          onClick={() => setView("featured")}
        >
          Featured
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "all"}
          className={cn(view === "all" && "is-active")}
          onClick={() => setView("all")}
        >
          All Repositories ({githubProjects.repos.length})
        </button>
      </div>
      {view === "all" ? <AllReposView /> : (
    <div className="projects-app">
      <ScrollPane className="projects-list-pane">
        <div className="project-list">
          {portfolio.projects.map((project) => (
            <button
              className={cn("project-row", selectedProject.name === project.name && "is-selected")}
              key={project.name}
              type="button"
              onClick={() => setSelectedProjectName(project.name)}
            >
              <span className="project-thumb">{project.name.slice(0, 1)}</span>
              <span>
                <strong>{project.name}</strong>
                <small>{project.stack}</small>
              </span>
            </button>
          ))}
        </div>
      </ScrollPane>
      <ScrollPane className="project-detail-pane">
        <article className="project-detail">
          <div className="project-hero">
            <span>{selectedProject.name.slice(0, 2)}</span>
          </div>
          <p className="app-kicker">{selectedProject.stack}</p>
          <h1>{selectedProject.name}</h1>
          <p>{selectedProject.summary}</p>
          {selectedProject.link ? (
            <a className="xp-control primary" href={selectedProject.link} target="_blank" rel="noreferrer">
              Open {externalLabel(selectedProject.link)}
            </a>
          ) : null}
        </article>
      </ScrollPane>
    </div>
      )}
    </div>
  );
}

function ContactApp() {
  return (
    <ScrollPane>
      <section className="contact-app">
        <div className="mail-header">
          <span>To:</span>
          <a href={portfolio.links.email}>maxwell.mohammadi@gmail.com</a>
        </div>
        <div className="mail-header">
          <span>Subject:</span>
          <strong>Aptos product / agent infrastructure</strong>
        </div>
        <textarea
          readOnly
          value={
            "Send context on the protocol, product, or workflow you want to ship. Email is the fastest way to reach me.\n\nI can help with Move systems, demo infrastructure, transaction composition, onchain trading flows, and agent tooling."
          }
        />
        <div className="contact-actions">
          <a className="xp-control primary" href={portfolio.links.email}>
            Send Message
          </a>
          <a className="xp-control" href={portfolio.links.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="xp-control" href={portfolio.links.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </div>
      </section>
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
  openApp: (id: AppId) => void;
  crtEnabled: boolean;
  onToggleCrt: () => void;
}) {
  const app = appCatalog[record.id];
  const sectionRef = useRef<HTMLElement | null>(null);
  const exitAnimationRef = useRef<Animation | null>(null);
  const layoutAnimationRef = useRef<Animation | null>(null);
  const maximizeFromRectRef = useRef<DOMRect | null>(null);
  const previousMinimizedRef = useRef(record.minimized);
  const style = record.maximized
    ? { zIndex: record.z }
    : { left: record.x, top: record.y, width: record.width, height: record.height, zIndex: record.z };

  const animateOut = (
    keyframes: Keyframe[],
    done: () => void,
    options: { duration?: number; easing?: string } = {},
  ) => {
    const element = sectionRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (exitAnimationRef.current) return;
    if (!element || reduceMotion || typeof element.animate !== "function") {
      done();
      return;
    }
    layoutAnimationRef.current?.cancel();
    layoutAnimationRef.current = null;
    const animation = element.animate(keyframes, {
      duration: options.duration ?? 150,
      easing: options.easing ?? "cubic-bezier(0.23, 1, 0.32, 1)",
      fill: "forwards",
    });
    exitAnimationRef.current = animation;
    void animation.finished.then(done).catch(() => {
      exitAnimationRef.current = null;
    });
  };

  const handleClose = () =>
    animateOut(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.96)" },
      ],
      () => onClose(record.id),
    );

  const handleMinimize = () => {
    const element = sectionRef.current;
    const taskbarButton = document.querySelector<HTMLElement>(`[data-taskbar-app="${record.id}"]`);
    const windowRect = element?.getBoundingClientRect();
    const taskbarRect = taskbarButton?.getBoundingClientRect();
    const x = windowRect && taskbarRect ? taskbarRect.left + taskbarRect.width / 2 - (windowRect.left + windowRect.width / 2) : 0;
    const y = windowRect && taskbarRect ? taskbarRect.top + taskbarRect.height / 2 - (windowRect.top + windowRect.height / 2) : 46;
    animateOut(
      [
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", transformOrigin: "center" },
        { opacity: 0, transform: `translate3d(${x}px, ${y}px, 0) scale(0.18)`, transformOrigin: "center" },
      ],
      () => onMinimize(record.id),
      { duration: 190, easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
    );
  };

  const handleMaximize = (event?: ReactMouseEvent<HTMLElement>) => {
    if (event && (event.target as Element).closest(".window-buttons")) return;
    maximizeFromRectRef.current = sectionRef.current?.getBoundingClientRect() ?? null;
    onMaximize(record.id);
  };

  useLayoutEffect(() => {
    const element = sectionRef.current;
    const from = maximizeFromRectRef.current;
    maximizeFromRectRef.current = null;
    if (!element || !from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const to = element.getBoundingClientRect();
    if (to.width <= 0 || to.height <= 0) return;
    const x = from.left - to.left;
    const y = from.top - to.top;
    const scaleX = from.width / to.width;
    const scaleY = from.height / to.height;
    layoutAnimationRef.current?.cancel();
    const animation = element.animate(
      [
        {
          transform: `translate3d(${x}px, ${y}px, 0) scale(${scaleX}, ${scaleY})`,
          transformOrigin: "top left",
        },
        { transform: "translate3d(0, 0, 0) scale(1)", transformOrigin: "top left" },
      ],
      { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "both" },
    );
    layoutAnimationRef.current = animation;
    void animation.finished.then(() => animation.cancel()).catch(() => {});
  }, [record.maximized]);

  useLayoutEffect(() => {
    const wasMinimized = previousMinimizedRef.current;
    previousMinimizedRef.current = record.minimized;
    if (!wasMinimized || record.minimized) return;

    const element = sectionRef.current;
    const taskbarButton = document.querySelector<HTMLElement>(`[data-taskbar-app="${record.id}"]`);
    if (!element || !taskbarButton || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      exitAnimationRef.current?.cancel();
      exitAnimationRef.current = null;
      return;
    }

    exitAnimationRef.current?.cancel();
    exitAnimationRef.current = null;
    const windowRect = element.getBoundingClientRect();
    const taskbarRect = taskbarButton.getBoundingClientRect();
    const x = taskbarRect.left + taskbarRect.width / 2 - (windowRect.left + windowRect.width / 2);
    const y = taskbarRect.top + taskbarRect.height / 2 - (windowRect.top + windowRect.height / 2);
    layoutAnimationRef.current?.cancel();
    const animation = element.animate(
      [
        { opacity: 0, transform: `translate3d(${x}px, ${y}px, 0) scale(0.18)`, transformOrigin: "center" },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", transformOrigin: "center" },
      ],
      { duration: 210, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "both" },
    );
    layoutAnimationRef.current = animation;
    void animation.finished.then(() => animation.cancel()).catch(() => {});
  }, [record.id, record.minimized]);

  useEffect(
    () => () => {
      layoutAnimationRef.current?.cancel();
    },
    [],
  );

  const menus: WindowMenu[] = [
    {
      label: "File",
      items: [
        { label: "New Window", disabled: true },
        { label: "Open Resume PDF", href: portfolio.links.resume },
        "separator",
        { label: "Close", onSelect: handleClose },
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
        { label: record.maximized ? "Restore" : "Maximize", onSelect: () => handleMaximize() },
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
    <section
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
    >
      <header
        className="window-titlebar"
        onPointerDown={(event) => onDragStart(event, record)}
        onDoubleClick={(event) => handleMaximize(event)}
      >
        <div className="titlebar-title">
          <img src={app.icon} alt="" draggable={false} />
          <strong>{app.title}</strong>
        </div>
        <div className="window-buttons" onPointerDown={(event) => event.stopPropagation()}>
          <Tooltip label="Minimize">
            <button type="button" aria-label={`Minimize ${app.title}`} onClick={handleMinimize}>
              _
            </button>
          </Tooltip>
          <Tooltip label={record.maximized ? "Restore Down" : "Maximize"}>
            <button
              type="button"
              aria-label={`${record.maximized ? "Restore" : "Maximize"} ${app.title}`}
              onClick={() => handleMaximize()}
            >
              □
            </button>
          </Tooltip>
          <Tooltip label="Close">
            <button type="button" aria-label={`Close ${app.title}`} onClick={handleClose}>
              ×
            </button>
          </Tooltip>
        </div>
      </header>
      <MenuBar menus={menus} ariaLabel={`${app.title} menu`} />
      <div className="window-toolbar">
        <button type="button" onClick={() => openApp("projects")}>
          <img src={appCatalog.projects.icon} alt="" />
          Projects
        </button>
        <button type="button" onClick={() => openApp("demos")}>
          <img src={appCatalog.demos.icon} alt="" />
          Demos
        </button>
        <button type="button" onClick={() => openApp("stats")}>
          <img src={appCatalog.stats.icon} alt="" />
          Stats
        </button>
        <button type="button" onClick={() => openApp("contact")}>
          <img src={appCatalog.contact.icon} alt="" />
          Contact
        </button>
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
        <button
          className="resize-handle"
          type="button"
          aria-label={`Resize ${app.title}`}
          onPointerDown={(event) => onResizeStart(event, record)}
        />
      ) : null}
    </section>
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
    <aside
      ref={menuRef}
      id="maxxp-start-menu"
      className="start-menu"
      data-state={open ? "open" : "closed"}
      aria-label="Start menu"
      aria-hidden={!open}
      inert={!open}
    >
      <header className="start-menu-header">
        <span className="start-avatar">M</span>
        <strong>{portfolio.name}</strong>
      </header>
      <div className="start-menu-body">
        <div className="start-menu-left">
          {(["projects", "stats", "contact", "about", "resume", "demos"] as AppId[]).map((id) => (
            <button key={id} type="button" onClick={() => openApp(id)}>
              <img src={appCatalog[id].icon} alt="" />
              <span>
                <strong>{appCatalog[id].title}</strong>
                <small>{appCatalog[id].status}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="start-menu-right">
          <a href={portfolio.links.github} target="_blank" rel="noreferrer">
            <img src={`${xp}/gui/start-menu/github.webp`} alt="" />
            GitHub
          </a>
          <a href={portfolio.links.linkedin} target="_blank" rel="noreferrer">
            <img src={`${xp}/gui/start-menu/linkedin.webp`} alt="" />
            LinkedIn
          </a>
          <button type="button" onClick={() => openApp("resume")}>
            <img src={`${xp}/gui/start-menu/recently-used.webp`} alt="" />
            Recently Used
          </button>
          <button type="button" onClick={() => openApp("demos")}>
            <img src={`${xp}/gui/start-menu/mediaPlayer.webp`} alt="" />
            Media Player
          </button>
        </div>
      </div>
      <footer className="start-menu-footer">
        <button type="button" onClick={onLogOff}>
          <img src={`${xp}/gui/start-menu/logoff.webp`} alt="" />
          Log Off
        </button>
        <button type="button" onClick={onLogOff}>
          <img src={`${xp}/gui/start-menu/shutdown.webp`} alt="" />
          Shut Down
        </button>
      </footer>
    </aside>
  );
}

function App() {
  const [phase, setPhase] = useState<BootPhase>("boot");
  const [startOpen, setStartOpen] = useState(false);
  const [crtEnabled, setCrtEnabled] = useState(readCrtPreference);
  const [showWelcome, setShowWelcome] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [windows, setWindows] = useState<WindowRecord[]>([
    { id: "about", x: 168, y: 78, width: 790, height: 650, z: 2, minimized: false, maximized: false },
  ]);
  const [activeWindow, setActiveWindow] = useState<AppId | null>("about");
  const [drag, setDrag] = useState<DragState | null>(null);
  const zRef = useRef(3);

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase("login"), 1800);
    return () => window.clearTimeout(timer);
  }, []);

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

  const openApp = useCallback(
    (id: AppId) => {
      setStartOpen(false);
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

  const login = () => {
    setPhase("welcome");
    playSound("login");
  };

  const logOff = () => {
    playSound("logoff");
    setStartOpen(false);
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

  if (phase === "boot") return <BootScreen />;
  if (phase === "login") return <LoginScreen onLogin={login} />;
  if (phase === "welcome") return <WelcomeScreen />;

  return (
    <main className={cn("maxxp-desktop", crtEnabled && "crt-on")}>
      <div className="maxxp-wallpaper" aria-hidden="true" />

      <section className="desktop-icons" id="desktop-icons" aria-label="Desktop applications">
        {desktopApps.map((id) => (
          <button key={id} className="desktop-icon" type="button" onClick={() => openApp(id)}>
            <img src={appCatalog[id].icon} alt="" draggable={false} />
            <span>{appCatalog[id].desktopLabel}</span>
          </button>
        ))}
      </section>

      <div className="windows-layer">
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
              openApp={openApp}
              crtEnabled={crtEnabled}
              onToggleCrt={() => setCrtEnabled((value) => !value)}
            >
              {contentForWindow(windowRecord)}
            </WindowChrome>
          ))}
      </div>

      <StartMenu open={startOpen} openApp={openApp} onClose={closeStartMenu} onLogOff={logOff} />

      <TrayBalloon title="Welcome to MaxXP" visible={showWelcome} onClose={() => setShowWelcome(false)}>
        Take the tour — open Demo Reel for the new reels feed, or browse the projects and resume. Every window is
        wired to real portfolio content.
      </TrayBalloon>

      <footer className="taskbar">
        <button
          className={cn("start-button", startOpen && "is-active")}
          type="button"
          aria-expanded={startOpen}
          aria-controls="maxxp-start-menu"
          onClick={() => setStartOpen((value) => !value)}
        >
          <img src={`${xp}/gui/taskbar/start-button.webp`} alt="Start" />
        </button>
        <ScrollPane className="taskbar-programs-scroll">
          <div className="taskbar-programs">
            {windows.map((windowRecord) => (
              <button
                key={windowRecord.id}
                data-taskbar-app={windowRecord.id}
                className={cn(activeWindow === windowRecord.id && !windowRecord.minimized && "is-active")}
                type="button"
                onClick={() => focusWindow(windowRecord.id)}
              >
                <img src={appCatalog[windowRecord.id].icon} alt="" />
                {appCatalog[windowRecord.id].shortTitle}
              </button>
            ))}
          </div>
        </ScrollPane>
        <div className="system-tray">
          <Tooltip label="Show welcome message">
            <button type="button" aria-label="Show welcome message" onClick={() => setShowWelcome((value) => !value)}>
              <img src={`${xp}/gui/taskbar/welcome.webp`} alt="" />
            </button>
          </Tooltip>
          <Tooltip label="Toggle CRT effects">
            <button type="button" aria-label="Toggle CRT effects" onClick={() => setCrtEnabled((value) => !value)}>
              <img src={`${xp}/gui/taskbar/crt.webp`} alt="" />
            </button>
          </Tooltip>
          <Tooltip label="Enter full screen">
            <button type="button" aria-label="Toggle fullscreen mode" onClick={() => document.documentElement.requestFullscreen?.()}>
              <img src={`${xp}/gui/taskbar/fullscreen.webp`} alt="" />
            </button>
          </Tooltip>
          <Tooltip label={now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}>
            <time dateTime={now.toISOString()}>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
          </Tooltip>
        </div>
      </footer>
      <div className="crt-scanline" aria-hidden="true" />
      <div className="crt-vignette" aria-hidden="true" />
    </main>
  );
}

export default App;
