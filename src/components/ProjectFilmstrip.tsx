/**
 * XP's Filmstrip view for selected work: one project loops on the stage, the
 * strip below picks the next, and the build notes live in a Properties sheet.
 * Each demo plays only its chosen stretch, muted, then the strip moves on.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { portfolio, type PortfolioVideo, type Project } from "../data/portfolio";
import { projectId } from "../data/liveApps";
import { navigate, routeHash } from "../lib/navigation";
import { CopyLink } from "./CopyLink";
import type { LiveProject } from "./LiveProjectApp";

const gui = "/xp/gui";
/** How long a still (or a demo the browser won't autoplay) stays on stage. */
const STILL_MS = 7000;

type Slide = { id: string; project: Project; video?: PortfolioVideo; poster?: string };

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function ProjectFilmstrip({ projects, active, selectedId, onOpenSite }: {
  projects: Project[];
  active: boolean;
  selectedId?: string;
  onOpenSite: (project: LiveProject) => void;
}) {
  const slides: Slide[] = useMemo(() => projects.map((project) => {
    const video = portfolio.videos.find((item) => item.id === project.demoId);
    return { id: projectId(project), project, video, poster: video?.poster ?? project.poster };
  }), [projects]);
  const [index, setIndex] = useState(() => Math.max(0, slides.findIndex((slide) => slide.id === selectedId)));
  const [still] = useState(prefersReducedMotion);
  const [blocked, setBlocked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [properties, setProperties] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const thumbsRef = useRef<HTMLOListElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  const slide = slides[index] ?? slides[0];
  const [start, end] = slide.project.loop ?? [0, slide.video?.durationSeconds ?? 8];
  // Auto-advance only while the visitor is watching the strip itself.
  const running = active && !hidden && !still && !expanded && !properties;

  const select = useCallback((next: number, remember = false) => {
    const wrapped = (next + slides.length) % slides.length;
    setIndex(wrapped);
    setBlocked(false);
    setExpanded(false);
    setProperties(false);
    if (remember) navigate({ app: "projects", project: slides[wrapped].id }, true);
  }, [slides]);
  const advance = useCallback(() => select(index + 1), [select, index]);

  // Shared links and Copy link pick their project.
  useEffect(() => {
    const target = slides.findIndex((item) => item.id === selectedId);
    if (target >= 0) setIndex(target);
  }, [selectedId, slides]);

  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // Keep the current thumbnail in view without scrolling the page.
  useEffect(() => {
    const strip = thumbsRef.current;
    const thumb = strip?.children[index] as HTMLElement | undefined;
    if (!strip || !thumb) return;
    strip.scrollTo({ left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2, behavior: still ? "auto" : "smooth" });
  }, [index, still]);

  // Play the chosen stretch muted; the browser may still refuse (Low Power Mode).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || expanded) return;
    if (!running && !still) {
      video.pause();
      return;
    }
    if (still) return;
    video.muted = true;
    if (video.currentTime < start || video.currentTime >= end) video.currentTime = start;
    video.play().catch(() => setBlocked(true));
  }, [running, still, expanded, start, end, slide.id]);

  // The progress bar follows the recording itself, then hands to the next slide.
  useEffect(() => {
    const video = videoRef.current;
    const bar = progressRef.current;
    if (!video || !bar || !running || blocked) return;
    let frame = 0;
    const tick = () => {
      const t = video.currentTime;
      if (t >= end - 0.05 || video.ended) {
        advance();
        return;
      }
      bar.style.clipPath = `inset(0 ${(1 - Math.min(1, Math.max(0, (t - start) / (end - start)))) * 100}% 0 0)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, blocked, start, end, advance, slide.id]);

  // Leaving full screen returns the demo to its muted loop.
  useEffect(() => {
    if (!expanded) return;
    const video = videoRef.current;
    const exit = () => {
      if (document.fullscreenElement) return;
      setExpanded(false);
    };
    document.addEventListener("fullscreenchange", exit);
    video?.addEventListener("webkitendfullscreen", exit);
    return () => {
      document.removeEventListener("fullscreenchange", exit);
      video?.removeEventListener("webkitendfullscreen", exit);
    };
  }, [expanded]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || expanded) return;
    video.controls = false;
    video.muted = true;
  }, [expanded]);

  useEffect(() => {
    if (!properties) return;
    okRef.current?.focus({ preventScroll: true });
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setProperties(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [properties]);

  const openSite = () => slide.project.link && onOpenSite({ name: slide.project.name, url: slide.project.link });

  const watch = () => {
    const video = videoRef.current;
    if (!video) return;
    setExpanded(true);
    setBlocked(false);
    video.controls = true;
    video.muted = false;
    void video.play().catch(() => {});
    const iosVideo = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (stageRef.current?.requestFullscreen) void stageRef.current.requestFullscreen().catch(() => {});
    else iosVideo.webkitEnterFullscreen?.();
  };

  const { project, video } = slide;
  const hasApp = Boolean(project.link && project.link !== project.code);

  return (
    <div
      className="filmstrip"
      onKeyDown={(event) => {
        if (properties || (event.target as HTMLElement).closest("input")) return;
        if (event.key === "ArrowRight") { event.preventDefault(); select(index + 1, true); }
        if (event.key === "ArrowLeft") { event.preventDefault(); select(index - 1, true); }
      }}
    >
      <div className="filmstrip-stage" ref={stageRef} style={{ "--focus": project.focus ?? "50% 50%" } as CSSProperties}>
        {video ? (
          <video
            key={slide.id}
            ref={videoRef}
            className="filmstrip-media"
            src={`${video.sources[0].src}#t=${start}`}
            poster={video.poster}
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            aria-label={`${project.name} demo`}
            onError={() => setBlocked(true)}
          />
        ) : (
          <picture key={slide.id}>
            {project.focusPoster ? <source media="(max-width: 620px)" srcSet={project.focusPoster} /> : null}
            <img className={running ? "filmstrip-media is-drifting" : "filmstrip-media"} src={slide.poster} alt={`${project.name} screenshot`} />
          </picture>
        )}
        {!expanded && (video || project.link) ? (
          <button type="button" className="filmstrip-stage-action" onClick={video ? watch : openSite}>
            <span>
              <img src={video ? `${gui}/start-menu/mediaPlayer.webp` : `${gui}/desktop/projects.webp`} alt="" />
              {video ? "Watch full demo" : "Try app"}
            </span>
          </button>
        ) : null}
        {!still && !expanded ? (
          <span className="filmstrip-progress" aria-hidden="true">
            <span
              key={`${slide.id}-${blocked || !video}`}
              ref={progressRef}
              className={!video || blocked ? "is-timed" : undefined}
              style={{ animationDuration: `${STILL_MS}ms`, animationPlayState: running ? "running" : "paused" }}
              onAnimationEnd={advance}
            />
          </span>
        ) : null}
        {properties ? (
          <section className="filmstrip-properties" role="dialog" aria-modal="false" aria-labelledby="filmstrip-properties-title">
            <header>
              <h3 id="filmstrip-properties-title">{project.name} Properties</h3>
            </header>
            <dl>
              {project.category ? <div><dt>Type</dt><dd>{project.category}</dd></div> : null}
              <div><dt>Built with</dt><dd>{project.stack}</dd></div>
              {project.contribution ? <div><dt>My work</dt><dd>{project.contribution}</dd></div> : null}
              {project.details?.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.text}</dd></div>)}
            </dl>
            <footer>
              <CopyLink href={routeHash({ app: "projects", project: slide.id })} />
              <button ref={okRef} type="button" className="xp-control" onClick={() => setProperties(false)}>OK</button>
            </footer>
          </section>
        ) : null}
      </div>

      <div className="filmstrip-caption">
        <div className="filmstrip-title">
          <h2>{project.name}</h2>
          <button
            type="button"
            className="filmstrip-info"
            aria-label={`${project.name} properties`}
            aria-expanded={properties}
            title="Properties"
            onClick={() => setProperties((open) => !open)}
          >
            <img src={`${gui}/tray/info.webp`} alt="" />
          </button>
        </div>
        <p>{project.summary}</p>
        {hasApp || project.code ? (
          <div className="filmstrip-actions">
            {hasApp ? (
              <button type="button" className="xp-control primary" onClick={openSite}>
                <img src={`${gui}/desktop/projects.webp`} alt="" />Open app
              </button>
            ) : null}
            {project.code ? (
              <a className="xp-control" href={project.code} target="_blank" rel="noreferrer">
                <img src={`${gui}/start-menu/github.webp`} alt="" />Source
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="filmstrip-strip">
        <button type="button" className="filmstrip-nav" aria-label="Previous project" onClick={() => select(index - 1, true)}>
          <img src={`${gui}/toolbar/back.webp`} alt="" />
        </button>
        <ol ref={thumbsRef} aria-label="Projects">
          {slides.map((item, position) => (
            <li key={item.id}>
              <button
                type="button"
                aria-label={item.project.name}
                aria-current={position === index ? "true" : undefined}
                onClick={() => select(position, true)}
              >
                <img
                  src={item.project.focusPoster ?? item.poster}
                  alt=""
                  loading={position < 4 ? "eager" : "lazy"}
                  style={{ objectPosition: item.project.focus }}
                />
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="filmstrip-nav" aria-label="Next project" onClick={() => select(index + 1, true)}>
          <img src={`${gui}/toolbar/forward.webp`} alt="" />
        </button>
      </div>
    </div>
  );
}
