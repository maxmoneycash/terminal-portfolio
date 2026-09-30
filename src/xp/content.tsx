/**
 * MaxXP window content: the About, Resume, and Contact apps, and the switch
 * that renders each window's app. The shell chrome lives in src/xp/*.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { portfolio } from "../data/portfolio";
import { cn } from "../lib/cn";
import { xp, type AppId, type WindowRecord } from "./types";
import { FileExplorerApp } from "../components/FileExplorerApp";
import { MinesweeperApp } from "../components/MinesweeperApp";
import { RecycleBinApp } from "../components/RecycleBinApp";
import { DisplayPropertiesApp } from "../components/DisplayPropertiesApp";
import { ReelsApp } from "../components/ReelsApp";
import { StatsApp } from "../components/StatsApp";
import { ScrollPane } from "./ScrollPane";

// The two apps that animate with framer-motion load on demand, which keeps
// that library out of the bundle the intro waits on. App prefetches them.
const loadProjectsApp = () => import("../components/ProjectsApp");
const loadSignatureNoteApp = () => import("../components/SignatureNoteApp");
const ProjectsApp = lazy(() => loadProjectsApp().then((m) => ({ default: m.ProjectsApp })));
const SignatureNoteApp = lazy(() => loadSignatureNoteApp().then((m) => ({ default: m.SignatureNoteApp })));

/** Starts downloading the on-demand apps so they are ready when a window opens. */
export function prefetchWindowApps() {
  void loadProjectsApp();
  void loadSignatureNoteApp();
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

export function openResumePdf() {
  window.dispatchEvent(new CustomEvent("maxxp:open-resume-pdf"));
}

function ResumeApp() {
  const [view, setView] = useState<"overview" | "pdf">("overview");

  useEffect(() => {
    const showPdf = () => setView("pdf");
    window.addEventListener("maxxp:open-resume-pdf", showPdf);
    return () => window.removeEventListener("maxxp:open-resume-pdf", showPdf);
  }, []);

  if (view === "pdf") {
    return (
      <div className="resume-pdf">
        <div className="resume-pdf-toolbar">
          <button className="xp-control" type="button" onClick={() => setView("overview")}>
            ← Overview
          </button>
          <span className="resume-pdf-title">Max_Mohammadi_Resume.pdf</span>
          <a className="xp-control" href={portfolio.links.resume} download>
            Save a Copy
          </a>
          <a className="xp-control" href="/Max_Mohammadi_Resume_ATS.pdf" download>
            ATS Version
          </a>
        </div>
        <iframe
          className="resume-pdf-frame"
          src={`${portfolio.links.resume}#toolbar=0&navpanes=0&view=FitH`}
          title="Max Mohammadi resume PDF"
        />
      </div>
    );
  }

  return (
    <ScrollPane>
      <div className="resume-app">
        <aside className="resume-sidebar">
          <img src={`${xp}/gui/desktop/resume.webp`} alt="" />
          <strong>{portfolio.name}</strong>
          <span>{portfolio.title}</span>
          <button className="xp-control primary" type="button" onClick={() => setView("pdf")}>
            Open PDF
          </button>
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
          <h2>Education</h2>
          <article className="resume-role">
            <div>
              <strong>{portfolio.education.school}</strong>
              <span>{portfolio.education.period}</span>
            </div>
            <h3>{portfolio.education.degree}</h3>
            <p>{portfolio.education.detail}</p>
          </article>
          <h2>Volunteering</h2>
          {portfolio.volunteering.map((entry) => (
            <article className="resume-role" key={entry.org}>
              <div>
                <strong>{entry.org}</strong>
              </div>
              <h3>{entry.role}</h3>
              <p>{entry.detail}</p>
            </article>
          ))}
          <h2>Honors & Organizations</h2>
          <article className="resume-role">
            <p>{portfolio.honors.join(" · ")}</p>
            <p>{portfolio.organizations.join(" · ")}</p>
          </article>
        </section>
      </div>
    </ScrollPane>
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

/** Renders the content of a window by app id. */
export function WindowContent({
  record,
  openApp,
}: {
  record: WindowRecord;
  openApp: (id: AppId) => void;
}) {
  switch (record.id) {
    case "signature":
      return (
        <Suspense fallback={null}>
          <SignatureNoteApp onContinue={() => openApp("about")} />
        </Suspense>
      );
    case "about":
      return <AboutApp openApp={openApp} />;
    case "files":
      return <FileExplorerApp />;
    case "resume":
      return <ResumeApp />;
    case "projects":
      return (
        <Suspense fallback={null}>
          <ProjectsApp />
        </Suspense>
      );
    case "demos":
      return <ReelsApp active={!record.minimized} />;
    case "contact":
      return <ContactApp />;
    case "stats":
      return <StatsApp />;
    case "minesweeper":
      return <MinesweeperApp />;
    case "recycle":
      return <RecycleBinApp />;
    case "display":
      return <DisplayPropertiesApp />;
  }
}
