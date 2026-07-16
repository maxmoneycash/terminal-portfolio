import { portfolio } from "../data/portfolio";

function hostLabel(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* Standalone print sheet rendered at /?print=resume — the source of
   public/Max_Mohammadi_Resume.pdf via headless Chrome print. */
export function PrintResume() {
  return (
    <main className="print-resume">
      <header className="pr-header">
        <h1>{portfolio.name}</h1>
        <p className="pr-role">
          {portfolio.title} · {portfolio.location}
        </p>
        <p className="pr-links">
          maxmohammadi.com · github.com/maxmoneycash · linkedin.com/in/maxwellmohammadi ·
          maxwell.mohammadi@gmail.com
        </p>
      </header>

      <p className="pr-summary">{portfolio.summary}</p>

      <section>
        <h2>Experience</h2>
        {portfolio.roles.map((role) => (
          <article className="pr-role-entry" key={`${role.company}-${role.period}`}>
            <div className="pr-role-head">
              <strong>
                {role.title} — {role.company}
              </strong>
              <span>{role.period}</span>
            </div>
            <p>{role.impact}</p>
          </article>
        ))}
      </section>

      <section>
        <h2>Selected Work</h2>
        {portfolio.projects.slice(0, 4).map((project) => (
          <article className="pr-role-entry" key={project.name}>
            <div className="pr-role-head">
              <strong>{project.name}</strong>
              <span>{hostLabel(project.link)}</span>
            </div>
            <p>{project.summary}</p>
          </article>
        ))}
      </section>

      <section>
        <h2>Education</h2>
        <article className="pr-role-entry">
          <div className="pr-role-head">
            <strong>
              {portfolio.education.degree} — {portfolio.education.school}
            </strong>
            <span>{portfolio.education.period}</span>
          </div>
          <p>{portfolio.education.detail}</p>
        </article>
      </section>

      <section>
        <h2>Honors &amp; Organizations</h2>
        <p className="pr-flat">{portfolio.honors.join(" · ")}</p>
        <p className="pr-flat">{portfolio.organizations.join(" · ")}</p>
      </section>
    </main>
  );
}
