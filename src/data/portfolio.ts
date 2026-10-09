import githubProjects from "./github-projects.json";

const publicRepo = (owner: string, name: string) => githubProjects.repositories.find(
  (repo) => !repo.private && repo.owner === owner && repo.name === name,
);
const cashTrading = publicRepo("SeamMoney", "cash.trading");
const txComposer = publicRepo("SeamMoney", "tx-composer");
const lilyshark = publicRepo("maxmoneycash", "lilyshark");
const nipahScan = publicRepo("maxmoneycash", "NIPAHSCAN");

export type Project = {
  id?: string;
  name: string;
  stack: string;
  summary: string;
  link?: string;
  code?: string;
  demoId?: string;
  category?: string;
  featured?: boolean;
  poster?: string;
  contribution?: string;
  details?: Array<{ label: string; text: string }>;
  /** Filmstrip loop: the stretch of the demo recording that plays, in seconds. */
  loop?: [start: number, end: number];
  /** Filmstrip crop on narrow screens, as a CSS object-position. */
  focus?: string;
  /** A still's own phone crop, used on narrow screens and as its thumbnail. */
  focusPoster?: string;
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
  /** Live app the clip demonstrates, shown as a link chip under the caption. */
  link?: string;
  /** Clip length, shown in the caption kicker. */
  durationSeconds?: number;
  /** Whether the clip carries a real audio track; the feed hides its sound toggle otherwise. */
  hasAudio?: boolean;
  /** Byte size of the MP4, shown in the My Videos explorer. */
  sizeBytes?: number;
  /** Pixel size of the MP4; the reel player sizes each clip to its shape. */
  width: number;
  height: number;
  sources: Array<{
    src: string;
    type: string;
    quality: string;
  }>;
};

export const portfolio = {
  name: "Maxwell Mohammadi",
  handle: "max",
  title: "Product engineer",
  location: "Palo Alto / San Francisco Bay Area",
  summary:
    "I build onchain products, developer tools, and trading infrastructure.",
  focus: ["Aptos Move", "Onchain trading", "LLM MCP servers", "High-throughput systems"],
  links: {
    email: "mailto:maxwell.mohammadi@gmail.com",
    github: "https://github.com/maxmoneycash",
    linkedin: "https://linkedin.com/in/maxwellmohammadi",
    resume: "/Max_Mohammadi_Resume.pdf",
  },
  projects: [
    ...(lilyshark ? [{
      id: "lilyshark",
      name: "Lilyshark",
      featured: true,
      category: "Radio & hardware",
      stack: "C++ · LoRa · TypeScript · Swift",
      summary: "A handheld radio analyzer, from firmware to interface.",
      contribution: "Firmware, web analyzer, and native clients.",
      link: lilyshark.homepage || undefined,
      code: lilyshark.url,
      poster: "/projects/lilyshark.png",
      focusPoster: "/projects/lilyshark-focus.jpg",
      focus: "50% 40%",
      details: [
        { label: "Built", text: "LoRa packet capture and decoding on the T-Deck, with a browser analyzer for inspecting frames and radio measurements." },
        { label: "Try it", text: "The analyzer includes labeled sample captures; no radio is needed to explore them." },
      ],
    }] : []),
    {
      id: "aptos-vs-megaeth",
      name: "Aptos vs MegaETH",
      category: "Trading & benchmarks",
      stack: "Move · React · trading bots",
      summary: "A prediction market with live, side-by-side chain benchmarks.",
      link: "https://aptos-polymarket.vercel.app/",
      demoId: "aptos-vs-megaeth",
      featured: true,
      loop: [30, 40],
      focus: "0% 50%",
      contribution: "Prediction-market UI and chain benchmark tooling.",
      details: [
        { label: "Demo", text: "The recording compares Aptos and MegaETH activity through block heatmaps, latency, and transaction throughput." },
        { label: "Context", text: "A benchmark demo for evaluating the Aptos stack. The displayed rates describe the recorded run." },
      ],
    },
    {
      id: "sol2move",
      name: "Sol2Move",
      category: "Compiler tooling",
      stack: "Solidity AST · Move v2 · differential fuzzing",
      summary: "Solidity contracts translated into Aptos Move, with validation.",
      link: undefined,
      demoId: "sol2move-boringvault",
      featured: true,
      loop: [5, 14],
      focus: "50% 40%",
      contribution: "Contract translation and validation tooling.",
      details: [
        { label: "Demo", text: "Veda’s BoringVault: a pipeline run, per-contract analysis, generated code, and a quality scorecard." },
      ],
    },
    {
      id: "cash-trading",
      name: "cash.trading",
      category: "Trading infrastructure",
      stack: "Decibel SDK · MCP · trading agents",
      summary: cashTrading?.description || "Trading on Decibel, with an automated volume bot.",
      link: "https://cash.trading/",
      code: cashTrading?.url,
      demoId: "decibrrr-live",
      featured: true,
      loop: [10, 20],
      focus: "40% 50%",
      contribution: "Trading strategies, SDK integrations, and MCP tools.",
      details: [
        { label: "Built", text: "Custom Decibel SDK paths, TWAP and market-maker strategies, and delegation-based trading." },
        { label: "Agents", text: "MCP workflows expose trading tools to coding agents. Shelby integrations support content rewards." },
        { label: "Demo", text: "A volume bot trading Decibel’s BTC/USD market, with progress tracked in the dashboard." },
      ],
    },
    ...(nipahScan ? [{
      id: "nipahscan",
      name: "NipahScan",
      featured: true,
      category: "Disease surveillance",
      stack: "Python · genomics · outbreak modeling",
      summary: "Real-time monitoring of the Nipah virus.",
      link: nipahScan.homepage || undefined,
      code: nipahScan.url,
      demoId: "nipahscan",
      loop: [0, 9] as [number, number],
      focus: "50% 50%",
      details: [
        { label: "Demo", text: "An environmental risk map, genome browser, variant analysis, vaccine design, and outbreak simulations." },
      ],
    }] : []),
    {
      id: "commits-sh",
      name: "commits.sh",
      featured: true,
      category: "Developer telemetry",
      stack: "REST API · MCP · CLI",
      summary: "GitHub activity and coding-agent usage in one live dashboard.",
      link: "https://commits.sh",
      demoId: "commits-sh-menubar",
      loop: [0, 16],
      focus: "50% 0%",
      details: [
        { label: "Demo", text: "The Mac menu-bar app streaming @maxmoneycash live, with the token counter and activity chart updating." },
      ],
    },
    {
      name: "tx-composer",
      stack: "Aptos · TypeScript · AI transaction plans",
      summary: txComposer?.description || "Compose and simulate Aptos transactions.",
      link: txComposer?.url,
    },
    {
      name: "Whop Finance",
      stack: "Aptos · Whop · Aave V3 · Panora",
      summary: "A finance demo for creator payments, yield, and agent banking.",
      link: "https://whop.finance/",
    },
  ] satisfies Project[],
  videos: [
    {
      id: "aptos-vs-megaeth",
      title: "Aptos vs MegaETH, live",
      date: "Featured",
      summary: "Aptos and MegaETH dashboards side by side around the Polymarket clone: block heatmaps, latency, and throughput updating in real time.",
      sourceFilename: "best_1",
      poster: "/videos/reels/posters/aptos-vs-megaeth-3fa7cf05.jpg",
      link: "https://aptos-polymarket.vercel.app",
      durationSeconds: 123.2,
      sizeBytes: 10158669,
      width: 1600,
      height: 1002,
      sources: [{ src: "/videos/reels/aptos-vs-megaeth-3fa7cf05.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "sol2move-boringvault",
      title: "Sol2Move on Veda's BoringVault",
      date: "March 25, 2026",
      summary: "Transpiling Veda's BoringVault contracts from Solidity to Aptos Move: the pipeline run, per-contract analysis, a side-by-side code comparison, and the quality scorecard.",
      sourceFilename: "veda-transpiler",
      poster: "/videos/reels/posters/sol2move-boringvault-777d1bf8.jpg",
      durationSeconds: 32.7,
      sizeBytes: 5051689,
      width: 1600,
      height: 1144,
      sources: [{ src: "/videos/reels/sol2move-boringvault-777d1bf8.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "aptos-block-machine",
      title: "Aptos Block Machine",
      date: "February 2026",
      summary: "Mainnet blocks streaming in live, a ranking of the most-called entry functions, and a flame graph from profiling one transaction.",
      sourceFilename: "Screen Recordings 2026-02-11, 2026-02-19, 2026-02-23",
      poster: "/videos/reels/posters/aptos-block-machine-ec30beed.jpg",
      link: "https://aptos-consensus-visualizer.vercel.app/block-machine",
      durationSeconds: 35.5,
      sizeBytes: 3043433,
      width: 1280,
      height: 752,
      sources: [{ src: "/videos/reels/aptos-block-machine-ec30beed.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "nipahscan",
      title: "NipahScan",
      date: "February 21, 2026",
      summary: "A Nipah virus surveillance workbench: environmental risk map, genome browser, variant analysis, vaccine design, and outbreak simulations.",
      sourceFilename: "Screen Recording 2026-02-21 at 10.57.13 PM",
      poster: "/videos/reels/posters/nipahscan-f3f7dd61.jpg",
      durationSeconds: 32.7,
      sizeBytes: 3402709,
      width: 1280,
      height: 832,
      sources: [{ src: "/videos/reels/nipahscan-f3f7dd61.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "aptos-hft-demo",
      title: "Aptos HFT demo",
      date: "January 6, 2026",
      summary: "The HFT page of the Polymarket clone on Aptos testnet at 2.2K TPS, peaking at 3.5K, then the markets and the live trade stream on the 2028 nominee market.",
      sourceFilename: "Screen Recording 2026-01-06 at 5.16.19 AM",
      poster: "/videos/reels/posters/aptos-hft-demo-e482b957.jpg",
      link: "https://aptos-polymarket.vercel.app",
      durationSeconds: 24.0,
      sizeBytes: 830674,
      width: 862,
      height: 1440,
      sources: [{ src: "/videos/reels/aptos-hft-demo-e482b957.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "decibrrr-live",
      title: "Decibrrr, live on Decibel",
      date: "December 1, 2025",
      summary: "The volume bot trading Decibel's BTC/USD market while its dashboard tracks progress toward a $10K volume target.",
      sourceFilename: "Screen Recording 2025-12-01 at 9.38.09 PM",
      poster: "/videos/reels/posters/decibrrr-live-8e754772.jpg",
      link: "https://cash.trading",
      durationSeconds: 151.6,
      sizeBytes: 8704750,
      width: 1280,
      height: 802,
      sources: [{ src: "/videos/reels/decibrrr-live-8e754772.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "seam-dex",
      title: "Seam",
      date: "February 6, 2024",
      summary: "An early SeamMoney DEX: a WBTC/USDC swap, then a concentrated-liquidity position set by dragging a price range over the liquidity histogram.",
      sourceFilename: "Screen Recording 2024-02-06 at 9.34.51 AM",
      poster: "/videos/reels/posters/seam-dex-0c246928.jpg",
      durationSeconds: 25.9,
      sizeBytes: 1032092,
      width: 1280,
      height: 662,
      sources: [{ src: "/videos/reels/seam-dex-0c246928.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "aptos-velociraptr",
      title: "Aptos Velociraptr",
      date: "December 22, 2025",
      summary: "A consensus explainer on live mainnet data: block river, throughput comparison, validator ring, and walkthroughs of Raptr, Block-STM, Quorum Store, and Shoal++.",
      sourceFilename: "Screen Recording 2025-12-22 at 1.13.01 AM",
      poster: "/videos/reels/posters/aptos-velociraptr-666f07a8.jpg",
      link: "https://aptos-consensus-visualizer.vercel.app",
      durationSeconds: 57.7,
      sizeBytes: 4933718,
      width: 730,
      height: 1440,
      sources: [{ src: "/videos/reels/aptos-velociraptr-666f07a8.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "aptos-load-test",
      title: "Aptos testnet under load",
      date: "January 29, 2026",
      summary: "Live TPS, block time, end-to-end latency, and block heatmap during a testnet load run.",
      sourceFilename: "Screen Recording 2026-01-29 at 2.58.21 AM",
      poster: "/videos/reels/posters/aptos-load-test-96667716.jpg",
      link: "https://aptos-polymarket.vercel.app",
      durationSeconds: 5.0,
      sizeBytes: 601645,
      width: 960,
      height: 1840,
      sources: [{ src: "/videos/reels/aptos-load-test-96667716.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "sol2move-generated-code",
      title: "Sol2Move: generated Move code",
      date: "March 25, 2026",
      summary: "The generated BoringVault Move module, with compatibility notes explaining the translation from Veda's Solidity contracts.",
      sourceFilename: "veda-transpiled-code",
      poster: "/videos/reels/posters/sol2move-generated-code-cea72509.jpg",
      durationSeconds: 5.0,
      sizeBytes: 3226660,
      width: 1600,
      height: 1386,
      sources: [{ src: "/videos/reels/sol2move-generated-code-cea72509.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "fee-market-simulator",
      title: "Fee markets under load",
      date: "January 2, 2026",
      summary: "A simulation: as the TPS slider climbs, Ethereum's fees and failure rate blow up while Aptos stays under a cent.",
      sourceFilename: "Screen Recording 2026-01-02 at 4.36.35 PM",
      poster: "/videos/reels/posters/fee-market-simulator-789cc20a.jpg",
      link: "https://aptos-consensus-visualizer.vercel.app",
      durationSeconds: 24.0,
      sizeBytes: 2710240,
      width: 1220,
      height: 1440,
      sources: [{ src: "/videos/reels/fee-market-simulator-789cc20a.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "shelby-pulse",
      title: "Shelby Pulse",
      date: "December 9, 2025",
      summary: "The ShelbyUSD view of a Shelby network monitor: bots minting ShelbyUSD on devnet, supply and top-holder stats, and live latency.",
      sourceFilename: "Screen Recording 2025-12-09 at 7.17.37 PM",
      poster: "/videos/reels/posters/shelby-pulse-48376f99.jpg",
      link: "https://shelby-pulse.vercel.app",
      durationSeconds: 28.8,
      sizeBytes: 1422069,
      width: 764,
      height: 1440,
      sources: [{ src: "/videos/reels/shelby-pulse-48376f99.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "peptide-tracker",
      title: "Peptide tracker",
      date: "June 15, 2026",
      summary: "A local-first peptide and hormone dose tracker built with Expo: dose logging with an injection-site map, estimated levels, a reconstitution calculator, stacks, inventory, an AI assistant, and a journal.",
      sourceFilename: "Screen Recording 2026-06-15 at 10.11.52 PM",
      poster: "/videos/reels/posters/peptide-tracker-81a17a80.jpg",
      durationSeconds: 71.3,
      sizeBytes: 3932403,
      width: 700,
      height: 1440,
      sources: [{ src: "/videos/reels/peptide-tracker-81a17a80.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "order-entry-ladder",
      title: "Order-entry ladder",
      date: "May 15, 2026",
      summary: "A price ladder with live depth where hovering a level previews the order, buy or sell, stop or limit, before you click.",
      sourceFilename: "Screen Recording 2026-05-15 at 9.52.46 AM",
      poster: "/videos/reels/posters/order-entry-ladder-49bf5bed.jpg",
      durationSeconds: 12.2,
      sizeBytes: 608488,
      width: 942,
      height: 1440,
      sources: [{ src: "/videos/reels/order-entry-ladder-49bf5bed.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "decibrrr-points",
      title: "Decibrrr",
      date: "February 3, 2026",
      summary: "A volume bot for farming Decibel points: configure the bot, track balance and trade history, and watch the Season 0 leaderboard. It grew into cash.trading.",
      sourceFilename: "Screen Recording 2026-02-03 at 8.59.08 PM",
      poster: "/videos/reels/posters/decibrrr-points-79ed8dd1.jpg",
      link: "https://cash.trading",
      durationSeconds: 25.3,
      sizeBytes: 4951541,
      width: 744,
      height: 1440,
      sources: [{ src: "/videos/reels/decibrrr-points-79ed8dd1.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "wick-markets-ride",
      title: "Wick Markets: Ride",
      date: "June 21, 2026",
      summary: "Tap and hold to ride a live candle chart, watch the P&L tick, and cash out.",
      sourceFilename: "Screen Recording 2026-06-21 at 5.49.11 PM",
      poster: "/videos/reels/posters/wick-markets-ride-dbec2aab.jpg",
      durationSeconds: 23.5,
      sizeBytes: 1332553,
      width: 1280,
      height: 756,
      sources: [{ src: "/videos/reels/wick-markets-ride-dbec2aab.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "emoji-candlestick-charts",
      title: "Emoji Candlestick Charts",
      date: "March 16, 2026",
      summary: "A React chart component that builds live BTC/USD candles out of stacked emoji.",
      sourceFilename: "Screen Recording 2026-03-16 at 11.06.05 PM",
      poster: "/videos/reels/posters/emoji-candlestick-charts-2c878f11.jpg",
      durationSeconds: 12.0,
      sizeBytes: 620159,
      width: 754,
      height: 1440,
      sources: [{ src: "/videos/reels/emoji-candlestick-charts-2c878f11.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "temper-trade",
      title: "Temper Trade",
      date: "December 15, 2025",
      summary: "Tap to pump a falling chart at $5 a tap, steer into green multiplier tiles, dodge the red ones, and ride it until liquidation.",
      sourceFilename: "Screen Recording 2025-12-15 at 7.02.30 PM",
      poster: "/videos/reels/posters/temper-trade-43f29147.jpg",
      durationSeconds: 32.0,
      sizeBytes: 2665560,
      width: 790,
      height: 1440,
      sources: [{ src: "/videos/reels/temper-trade-43f29147.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "aptos-validator-globe",
      title: "Aptos validator globe",
      date: "January 5, 2026",
      summary: "Aptos mainnet on a 3D globe: 120 validators, the live block height, and broadcast arcs, then a zoom into the Asia-Pacific validators.",
      sourceFilename: "Screen Recording 2026-01-05 at 11.28.43 PM",
      poster: "/videos/reels/posters/aptos-validator-globe-69442083.jpg",
      link: "https://aptos-consensus-visualizer.vercel.app/globe",
      durationSeconds: 11.4,
      sizeBytes: 3525001,
      width: 1280,
      height: 980,
      sources: [{ src: "/videos/reels/aptos-validator-globe-69442083.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "maxxp-desktop",
      title: "MaxXP: live developer stats",
      date: "August 5, 2026",
      summary: "The XP Task Manager switches from live token activity to the commit-velocity chart, backed by commits.sh.",
      sourceFilename: "Screen Recording 2026-08-05 at 9.44.00 PM",
      poster: "/videos/reels/posters/maxxp-desktop-0cadc59e.jpg",
      link: "https://www.maxmohammadi.com",
      durationSeconds: 5.0,
      sizeBytes: 980429,
      width: 900,
      height: 1728,
      sources: [{ src: "/videos/reels/maxxp-desktop-0cadc59e.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "commits-sh-menubar",
      title: "commits.sh in the menu bar",
      date: "September 26, 2026",
      summary: "The commits.sh Mac menu-bar app streaming @maxmoneycash live: the token counter ticks past 99.2 billion while the activity chart updates.",
      sourceFilename: "Screen Recording 2026-09-26 at 8.54.42 PM",
      poster: "/videos/reels/posters/commits-sh-menubar-5e3ba494.jpg",
      link: "https://commits.sh",
      durationSeconds: 16.0,
      sizeBytes: 700726,
      width: 944,
      height: 1270,
      sources: [{ src: "/videos/reels/commits-sh-menubar-5e3ba494.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "aptos-vs-megaeth-rerun",
      title: "Aptos vs MegaETH, another run",
      date: "January 31, 2026",
      summary: "The head-to-head dashboards again: the Aptos block heatmap and latency beside MegaETH's blocks, with the Polymarket clone in the middle.",
      sourceFilename: "Screen Recording 2026-01-31 at 1.11.09 AM",
      poster: "/videos/reels/posters/aptos-vs-megaeth-rerun-fe372544.jpg",
      link: "https://aptos-polymarket.vercel.app",
      durationSeconds: 35.5,
      sizeBytes: 3530967,
      width: 1600,
      height: 1002,
      sources: [{ src: "/videos/reels/aptos-vs-megaeth-rerun-fe372544.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "sol2move-first-run",
      title: "Sol2Move, first run",
      date: "February 24, 2026",
      summary: "An earlier transpiler run: paste a Solidity contract, transpile it, compare the Move output side by side, and review the parallelization analysis.",
      sourceFilename: "Screen Recording 2026-02-24 at 3.11.59 PM",
      poster: "/videos/reels/posters/sol2move-first-run-0034fc90.jpg",
      durationSeconds: 55.4,
      sizeBytes: 9122489,
      width: 1600,
      height: 1168,
      sources: [{ src: "/videos/reels/sol2move-first-run-0034fc90.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "aptos-testnet-nodes",
      title: "Aptos testnet node comparison",
      date: "January 29, 2026",
      summary: "An early testnet run comparing node regions and latency alongside live throughput and block timing.",
      sourceFilename: "Screen Recording 2026-01-29 at 6.46.53 PM",
      poster: "/videos/reels/posters/aptos-testnet-nodes-35021d4b.jpg",
      link: "https://aptos-polymarket.vercel.app",
      durationSeconds: 3.0,
      sizeBytes: 326278,
      width: 932,
      height: 1370,
      sources: [{ src: "/videos/reels/aptos-testnet-nodes-35021d4b.mp4", type: "video/mp4", quality: "HD" }],
    },
  ] satisfies PortfolioVideo[],
  roles: [
    {
      company: "Aptos Labs",
      title: "Independent Engineer, In Residence (unpaid)",
      period: "January 2026 — May 2026",
      impact:
        "Shipping LLM MCP servers, onchain trading bots, high-throughput Move contracts, and product demos for Decibel Trade, Shelby Protocol, Whop, and Polymarket-style prediction markets.",
    },
    {
      company: "EY",
      title: "Blockchain Consulting",
      period: "September 2024 — September 2025",
      impact:
        "Full-time blockchain consulting in the Bay Area practice — enterprise custody infrastructure, incident response, and cross-chain work across EVM and Move ecosystems.",
    },
    {
      company: "Blockchain Acceleration Foundation",
      title: "Board Member",
      period: "September 2022 — September 2023",
      impact: "Part-time board seat supporting university blockchain education and ecosystem programs.",
    },
    {
      company: "Blockchain at Cal Poly",
      title: "President",
      period: "June 2021 — September 2022",
      impact: "Led the university blockchain organization — education, industry partnerships, and the developer community.",
    },
    {
      company: "Sydereal",
      title: "Software Engineering Intern (Part-Time, during school year)",
      period: "December 2020 — October 2021",
      impact:
        "Migrated satellite telemetry from SQLite to InfluxDB and implemented spacecraft anomaly detection, saving about $150K.",
    },
    {
      company: "EY",
      title: "Forensic Data Analysis",
      period: "June 2021 — September 2021",
      impact: "Worked with Solidity, EVM, and DeFi protocols to create product research for clients.",
    },
    {
      company: "Proximai.com",
      title: "AI Research Intern (Part-Time, during school year)",
      period: "May 2020 — June 2021",
      impact: "Contributed to RaDAR, a spatial-temporal framework for military aircraft GO/NO-GO decisions.",
    },
    {
      company: "EY",
      title: "Forensics & Integrity Services",
      period: "July 2020 — August 2020",
      impact:
        "Intern cohort placed top 3 in the capstone; analyzed client data for sentiment and fraudulent financial reporting; built a COVID-19 back-to-work strategy and employee app concept for Ford; trained on Power BI, Alteryx, and Relativity.",
    },
    {
      company: "CSAI Cal Poly",
      title: "Data Science",
      period: "April 2019 — July 2020",
      impact:
        "Built parts of the CSAI voice assistant that answers Cal Poly CS department questions — office hours, prerequisites, and campus info.",
    },
    {
      company: "Camp PolyHacks",
      title: "Sponsorship Coordinator",
      period: "May 2019 — February 2020",
      impact:
        "Organized corporate sponsorships for the 2020 hackathon — 100+ students at the SLO HotHouse and $25,000+ raised.",
    },
    {
      company: "Valence Law Group, PC",
      title: "Administrative Intern",
      period: "July 2018 — September 2018",
      impact:
        "Helped design a data and workflow automation system for a commercial real-estate law firm; assisted on lease documents and attorney invoicing.",
    },
    {
      company: "Draco Clothing Company",
      title: "President",
      period: "November 2017 — July 2018",
      impact: "Led a Junior Achievement-sponsored student company teaching high schoolers how to run a business.",
    },
    {
      company: "Northgate Business Club",
      title: "President",
      period: "September 2017 — June 2018",
      impact: "Co-founded the high-school business club — career education and professional networking for students.",
    },
    {
      company: "Junior Achievement of Northern California",
      title: "Director of Sales, Fleece Bay",
      period: "December 2016 — November 2017",
      impact: "Ran sales strategy for the student company that won the JA Best Business Plan Award.",
    },
  ] satisfies Role[],
  education: {
    school: "California Polytechnic State University, San Luis Obispo",
    degree: "B.S. Computer Science",
    period: "2018 — 2023",
    detail: "President, Blockchain at Cal Poly",
  },
  honors: ["Junior Achievement Best Business Plan Award — Fleece Bay"],
  volunteering: [
    {
      org: "Junior Achievement of Northern California",
      role: "Classroom Volunteer (2016 — Present)",
      detail:
        "Volunteering with JA since high school; for the past three years taught the JA crypto curriculum across a dozen classroom sessions at SF East Bay and South Bay high schools, in Circle's scholarship partnership with Junior Achievement.",
    },
  ],
  organizations: ["Accounting Career Awareness Program (UC Berkeley)", "CalCPA", "National Association of Black Accountants"],
};
