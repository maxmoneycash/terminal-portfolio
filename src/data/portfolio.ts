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
