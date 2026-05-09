export type Project = {
  name: string;
  stack: string;
  summary: string;
  link?: string;
};

export type Role = {
  company: string;
  title: string;
  period: string;
  impact: string;
};

export const portfolio = {
  name: "Max Mohammadi",
  handle: "max",
  title: "Software engineer",
  location: "San Francisco Bay Area",
  summary:
    "I build fast, useful software with a bias toward thoughtful product details, clean systems, and interfaces people can actually operate.",
  focus: ["Product engineering", "Full-stack systems", "AI tooling", "Developer experience"],
  links: {
    email: "mailto:hello@example.com",
    github: "https://github.com/maxmohammadi",
    linkedin: "https://www.linkedin.com/in/maxmohammadi",
    resume: "/resume.txt",
  },
  projects: [
    {
      name: "Ops Console",
      stack: "React, TypeScript, Postgres",
      summary:
        "A compact internal dashboard for monitoring queues, failed jobs, and operational runbooks.",
      link: "https://example.com",
    },
    {
      name: "Agent Toolkit",
      stack: "Node.js, OpenAI APIs, Redis",
      summary:
        "A small framework for routing agent tasks across tools with durable traces and retry behavior.",
      link: "https://example.com",
    },
    {
      name: "Launch Site",
      stack: "Vite, Tailwind CSS, Motion",
      summary:
        "A performant marketing surface with reusable sections, structured content, and fast iteration paths.",
      link: "https://example.com",
    },
  ] satisfies Project[],
  roles: [
    {
      company: "Independent",
      title: "Product engineer",
      period: "2024 - Present",
      impact:
        "Designing and shipping focused web products, prototypes, and automation for early-stage teams.",
    },
    {
      company: "Previous team",
      title: "Full-stack engineer",
      period: "2021 - 2024",
      impact:
        "Built customer-facing workflows, improved reliability, and made product analytics easier to act on.",
    },
  ] satisfies Role[],
};
