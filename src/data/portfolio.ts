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

export type PortfolioVideo = {
  id: string;
  title: string;
  date: string;
  summary: string;
  sourceFilename: string;
  poster: string;
  sources: Array<{
    src: string;
    type: string;
    quality: string;
  }>;
};

export const portfolio = {
  name: "Maxwell Mohammadi",
  handle: "max",
  title: "Smart contract engineer",
  location: "Palo Alto / San Francisco Bay Area",
  summary:
    "I build Aptos Move systems, onchain trading products, LLM agent infrastructure, and high-throughput crypto demos for teams evaluating the Aptos stack.",
  focus: ["Aptos Move", "Onchain trading", "LLM MCP servers", "High-throughput systems"],
  links: {
    email: "mailto:maxwell.mohammadi@gmail.com",
    github: "https://github.com/maxmoneycash",
    linkedin: "https://linkedin.com/in/maxwellmohammadi",
    resume: "/Max_Mohammadi_Resume.pdf",
  },
  projects: [
    {
      name: "Aptos Prediction Market",
      stack: "Move, Aptos, React, HFT demo infrastructure",
      summary:
        "Built a Polymarket-style Aptos demo with Move contracts, market UI, live trade streams, TPS dashboard, HFT bot visualization, and 10k TPS pitch benchmarks.",
      link: "https://aptos-polymarket.vercel.app/",
    },
    {
      name: "Whop Finance",
      stack: "Aptos, Whop, Aave V3, Panora, x402a",
      summary:
        "Built a Whop-style Aptos finance demo with Tether WDK flows, creator payments, yield, cross-chain transfers, investing, and agent banking account views.",
      link: "https://whop.finance/",
    },
    {
      name: "Decibel / Shelby Agent Infrastructure",
      stack: "MCP servers, Decibel SDK, PineScript, Shelby",
      summary:
        "Built Decibrrr with custom Decibel onchain SDK paths, TWAP and market maker strategies, delegation-based trading, Shelby content rewards, and MCP workflows.",
      link: "https://github.com/SeamMoney/decibrrr",
    },
    {
      name: "Sol2Move",
      stack: "Solidity AST, Move v2, parser validation, fuzzing",
      summary:
        "Built a Solidity-to-Aptos Move v2 transpiler with Solidity analysis, inheritance flattening, OpenZeppelin support, Move parsing, validation, and differential fuzzing.",
      link: "https://github.com/SeamMoney/aptos-move-transpiler",
    },
    {
      name: "tx-composer",
      stack: "Aptos Script Composer, TypeScript SDK, AI JSON plans",
      summary:
        "Built simulate-first Aptos transaction composition tooling with declarative Move call steps, return wiring, balance tracking, VM error diagnosis, and JSON plans for AI agents.",
      link: "https://github.com/SeamMoney/tx-composer",
    },
  ] satisfies Project[],
  videos: [
    {
      id: "screen-2025-12-09-191737",
      title: "Demo clip 01",
      date: "December 9, 2025",
      summary: "A focused product walkthrough cut for quick review on the portfolio.",
      sourceFilename: "Screen Recording 2025-12-09 at 7.17.37 PM",
      poster: "/videos/posters/screen-2025-12-09-191737.jpg",
      sources: [
        { src: "/videos/hls/screen-2025-12-09-191737/index.m3u8", type: "application/vnd.apple.mpegurl", quality: "HLS" },
        { src: "/videos/screen-2025-12-09-191737.mp4", type: "video/mp4", quality: "HD" },
      ],
    },
    {
      id: "screen-2025-12-01-213809",
      title: "Demo clip 02",
      date: "December 1, 2025",
      summary: "A short screen recording intended to show the core interaction without extra page weight.",
      sourceFilename: "Screen Recording 2025-12-01 at 9.38.09 PM",
      poster: "/videos/posters/screen-2025-12-01-213809.jpg",
      sources: [
        { src: "/videos/hls/screen-2025-12-01-213809/index.m3u8", type: "application/vnd.apple.mpegurl", quality: "HLS" },
        { src: "/videos/screen-2025-12-01-213809.mp4", type: "video/mp4", quality: "HD" },
      ],
    },
    {
      id: "screen-2025-12-22-011301",
      title: "Demo clip 03",
      date: "December 22, 2025",
      summary: "A high-resolution walkthrough prepared for lazy playback inside the portfolio shell.",
      sourceFilename: "Screen Recording 2025-12-22 at 1.13.01 AM",
      poster: "/videos/posters/screen-2025-12-22-011301.jpg",
      sources: [
        { src: "/videos/hls/screen-2025-12-22-011301/index.m3u8", type: "application/vnd.apple.mpegurl", quality: "HLS" },
        { src: "/videos/screen-2025-12-22-011301.mp4", type: "video/mp4", quality: "HD" },
      ],
    },
    {
      id: "screen-2026-01-31-011109",
      title: "Demo clip 04",
      date: "January 31, 2026",
      summary: "A portfolio-ready clip with poster-first loading and click-to-play video delivery.",
      sourceFilename: "Screen Recording 2026-01-31 at 1.11.09 AM",
      poster: "/videos/posters/screen-2026-01-31-011109.jpg",
      sources: [
        { src: "/videos/hls/screen-2026-01-31-011109/index.m3u8", type: "application/vnd.apple.mpegurl", quality: "HLS" },
        { src: "/videos/screen-2026-01-31-011109.mp4", type: "video/mp4", quality: "HD" },
      ],
    },
    {
      id: "screen-2026-02-24-151159",
      title: "Demo clip 05",
      date: "February 24, 2026",
      summary: "A compact product proof clip surfaced from the terminal as a native browser video.",
      sourceFilename: "Screen Recording 2026-02-24 at 3.11.59 PM",
      poster: "/videos/posters/screen-2026-02-24-151159.jpg",
      sources: [
        { src: "/videos/hls/screen-2026-02-24-151159/index.m3u8", type: "application/vnd.apple.mpegurl", quality: "HLS" },
        { src: "/videos/screen-2026-02-24-151159.mp4", type: "video/mp4", quality: "HD" },
      ],
    },
    {
      id: "best-1",
      title: "Best cut",
      date: "Featured",
      summary: "The primary portfolio cut for visitors who only watch one demo.",
      sourceFilename: "best_1",
      poster: "/videos/posters/best-1.jpg",
      sources: [
        { src: "/videos/hls/best-1/index.m3u8", type: "application/vnd.apple.mpegurl", quality: "HLS" },
        { src: "/videos/best-1.mp4", type: "video/mp4", quality: "HD" },
      ],
    },
  ] satisfies PortfolioVideo[],
  roles: [
    {
      company: "Aptos Labs",
      title: "Software engineer",
      period: "September 2025 — Present",
      impact:
        "Shipping LLM MCP servers, onchain trading bots, high-throughput Move contracts, and product demos for Decibel Trade, Shelby Protocol, Whop, and Polymarket-style prediction markets.",
    },
    {
      company: "EY Blockchain",
      title: "Blockchain security consultant",
      period: "August 2022 — September 2025",
      impact:
        "Audited enterprise crypto custody infrastructure, led onchain incident response, and built cross-chain expertise across EVM, Aptos Move, Sui, Hyperliquid, and stablecoin systems.",
    },
  ] satisfies Role[],
};
