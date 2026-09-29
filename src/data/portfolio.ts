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
  /** Live app the clip demonstrates, shown as a link chip under the caption. */
  link?: string;
  /** Clip length, shown in the caption kicker. */
  durationSeconds?: number;
  /** Whether the clip carries a real audio track; the feed hides its sound toggle otherwise. */
  hasAudio?: boolean;
  /** Byte size of the MP4, shown in the My Videos explorer. */
  sizeBytes?: number;
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
      name: "commits.sh",
      stack: "Live dev-rank + AI-usage telemetry, REST API, MCP server, CLI",
      summary:
        "Built a product that turns GitHub activity into a live velocity index and dev rank, streaming real-time token telemetry from 8 coding agents — 67B+ tokens tracked with per-model cost and burn dashboards.",
      link: "https://commits.sh",
    },
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
      id: "best-1",
      title: "Aptos vs MegaETH, live",
      date: "Featured",
      summary: "Aptos and MegaETH dashboards side by side around the Polymarket clone: block heatmaps, latency, and throughput updating in real time.",
      sourceFilename: "best_1",
      poster: "/videos/posters/best-1.jpg",
      link: "https://aptos-polymarket.vercel.app",
      durationSeconds: 123.2,
      sizeBytes: 7189628,
      sources: [
        { src: "/videos/hls/best-1/index.m3u8", type: "application/vnd.apple.mpegurl", quality: "HLS" },
        { src: "/videos/best-1.mp4", type: "video/mp4", quality: "HD" },
      ],
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
      sources: [{ src: "/videos/reels/commits-sh-menubar-5e3ba494.mp4", type: "video/mp4", quality: "HD" }],
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
      sources: [{ src: "/videos/reels/aptos-validator-globe-69442083.mp4", type: "video/mp4", quality: "HD" }],
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
      sources: [{ src: "/videos/reels/aptos-block-machine-ec30beed.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "sol2move-boringvault",
      title: "Sol2Move on Veda's BoringVault",
      date: "March 25, 2026",
      summary: "Transpiling Veda's BoringVault contracts from Solidity to Aptos Move: the pipeline run, per-contract analysis, a side-by-side code comparison, and the quality scorecard.",
      sourceFilename: "veda-transpiler",
      poster: "/videos/reels/posters/sol2move-boringvault-76abea36.jpg",
      durationSeconds: 28.5,
      sizeBytes: 3077243,
      sources: [{ src: "/videos/reels/sol2move-boringvault-76abea36.mp4", type: "video/mp4", quality: "HD" }],
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
      sources: [{ src: "/videos/reels/temper-trade-43f29147.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "deepsurge-rounds",
      title: "DeepSurge",
      date: "June 25, 2026",
      summary: "One-tap UP or DOWN prediction rounds on Sui, with a live price feed and a round countdown.",
      sourceFilename: "Screen Recording 2026-06-25 at 6.25.30 PM",
      poster: "/videos/reels/posters/deepsurge-rounds-ddb4d3f0.jpg",
      link: "https://bloxwap-clone.vercel.app",
      durationSeconds: 17.4,
      sizeBytes: 1563230,
      sources: [{ src: "/videos/reels/deepsurge-rounds-ddb4d3f0.mp4", type: "video/mp4", quality: "HD" }],
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
      sources: [{ src: "/videos/reels/wick-markets-ride-dbec2aab.mp4", type: "video/mp4", quality: "HD" }],
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
      sources: [{ src: "/videos/reels/decibrrr-points-79ed8dd1.mp4", type: "video/mp4", quality: "HD" }],
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
      sources: [{ src: "/videos/reels/nipahscan-f3f7dd61.mp4", type: "video/mp4", quality: "HD" }],
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
      sources: [{ src: "/videos/reels/shelby-pulse-48376f99.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "screen-2025-12-22-011301",
      title: "Aptos Velociraptr",
      date: "December 22, 2025",
      summary: "A consensus explainer on live mainnet data: block river, throughput comparison, validator ring, and walkthroughs of Raptr, Block-STM, Quorum Store, and Shoal++.",
      sourceFilename: "Screen Recording 2025-12-22 at 1.13.01 AM",
      poster: "/videos/posters/screen-2025-12-22-011301.jpg",
      link: "https://aptos-consensus-visualizer.vercel.app",
      durationSeconds: 57.7,
      sizeBytes: 5787684,
      sources: [
        { src: "/videos/hls/screen-2025-12-22-011301/index.m3u8", type: "application/vnd.apple.mpegurl", quality: "HLS" },
        { src: "/videos/screen-2025-12-22-011301.mp4", type: "video/mp4", quality: "HD" },
      ],
    },
    {
      id: "screen-2025-12-01-213809",
      title: "Decibrrr, live on Decibel",
      date: "December 1, 2025",
      summary: "The volume bot trading Decibel's BTC/USD market while its dashboard tracks progress toward a $10K volume target.",
      sourceFilename: "Screen Recording 2025-12-01 at 9.38.09 PM",
      poster: "/videos/posters/screen-2025-12-01-213809.jpg",
      link: "https://cash.trading",
      durationSeconds: 153.1,
      sizeBytes: 7332206,
      sources: [
        { src: "/videos/hls/screen-2025-12-01-213809/index.m3u8", type: "application/vnd.apple.mpegurl", quality: "HLS" },
        { src: "/videos/screen-2025-12-01-213809.mp4", type: "video/mp4", quality: "HD" },
      ],
    },
    {
      id: "screen-2026-01-31-011109",
      title: "Aptos vs MegaETH, another run",
      date: "January 31, 2026",
      summary: "The head-to-head dashboards again: the Aptos block heatmap and latency beside MegaETH's blocks, with the Polymarket clone in the middle.",
      sourceFilename: "Screen Recording 2026-01-31 at 1.11.09 AM",
      poster: "/videos/posters/screen-2026-01-31-011109.jpg",
      link: "https://aptos-polymarket.vercel.app",
      durationSeconds: 35.5,
      sizeBytes: 2450511,
      sources: [
        { src: "/videos/hls/screen-2026-01-31-011109/index.m3u8", type: "application/vnd.apple.mpegurl", quality: "HLS" },
        { src: "/videos/screen-2026-01-31-011109.mp4", type: "video/mp4", quality: "HD" },
      ],
    },
    {
      id: "money-clicker",
      title: "Money Clicker",
      date: "February 7, 2025",
      summary: "Tap the stack and the bills fly: the counter climbs while CASH Power charges from green to red.",
      sourceFilename: "Screen Recording 2025-02-07 at 7.15.26 PM",
      poster: "/videos/reels/posters/money-clicker-12ae1291.jpg",
      link: "https://cash-clicker.vercel.app",
      durationSeconds: 32.3,
      sizeBytes: 5433696,
      sources: [{ src: "/videos/reels/money-clicker-12ae1291.mp4", type: "video/mp4", quality: "HD" }],
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
      sources: [{ src: "/videos/reels/emoji-candlestick-charts-2c878f11.mp4", type: "video/mp4", quality: "HD" }],
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
      sources: [{ src: "/videos/reels/order-entry-ladder-49bf5bed.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "screen-2026-02-24-151159",
      title: "Sol2Move, first run",
      date: "February 24, 2026",
      summary: "An earlier transpiler run: paste a Solidity contract, transpile it, compare the Move output side by side, and review the parallelization analysis.",
      sourceFilename: "Screen Recording 2026-02-24 at 3.11.59 PM",
      poster: "/videos/posters/screen-2026-02-24-151159.jpg",
      durationSeconds: 55.4,
      sizeBytes: 5485044,
      sources: [
        { src: "/videos/hls/screen-2026-02-24-151159/index.m3u8", type: "application/vnd.apple.mpegurl", quality: "HLS" },
        { src: "/videos/screen-2026-02-24-151159.mp4", type: "video/mp4", quality: "HD" },
      ],
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
      sources: [{ src: "/videos/reels/seam-dex-0c246928.mp4", type: "video/mp4", quality: "HD" }],
    },
    {
      id: "leverage-slider",
      title: "Leverage slider",
      date: "January 11, 2025",
      summary: "A leverage picker built as a Minecraft-style options slider, from 1x to 100x.",
      sourceFilename: "Screen Recording 2025-01-11 at 6.18.40 PM",
      poster: "/videos/reels/posters/leverage-slider-30a00e8f.jpg",
      durationSeconds: 8.9,
      sizeBytes: 238611,
      sources: [{ src: "/videos/reels/leverage-slider-30a00e8f.mp4", type: "video/mp4", quality: "HD" }],
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
