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
      stack: "Move, Aptos, React, performance engineering",
      summary:
        "Built a Polymarket-style Aptos demo and a prediction market Move contract optimized with Aptos engineers to reach 10k TPS in pitch benchmarks.",
      link: "https://aptos-polymarket.vercel.app/",
    },
    {
      name: "Whop Finance",
      stack: "Aptos, TypeScript, React, fintech product design",
      summary:
        "Built a Whop-style fintech demo showing trading, payments, and investing on Aptos, then iterated from direct CEO feedback during the pitch process.",
      link: "https://whop.finance/",
    },
    {
      name: "Decibel Trading Bots",
      stack: "LLM MCP servers, PineScript, Move, automated trading",
      summary:
        "Built agent infrastructure and automated bots that convert TradingView PineScript indicators into onchain smart contract trading strategies for Decibel Trade.",
    },
    {
      name: "Sol2Move",
      stack: "Solidity AST, Move, compiler IR, fuzzing",
      summary:
        "Built a Solidity-to-Aptos Move transpiler covering Veda BoringVault, Uniswap, Pendle, Trader Joe DLMM, and Compound-style contracts.",
      link: "https://github.com/SeamMoney/aptos-move-transpiler",
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
