import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";

const handle = "maxmoneycash";
const tickerUrl = `https://commits.sh/api/v1/ticker/${handle}`;
const badgeUrl = (style: string) => `https://commits.sh/api/badge?handle=${handle}&style=${style}&theme=dark`;
const profileAsset = (name: string) => `https://raw.githubusercontent.com/${handle}/${handle}/main/assets/${name}`;

type Ticker = {
  symbol: string;
  price: number;
  changePct30d: number;
  direction: "up" | "down";
  marketCap: number;
  analyst: string;
  page: string;
  stats: {
    commits52w: number;
    peakWeek: number;
    busiestDay: number;
    activeDays: number;
    longestStreak: number;
    currentStreak: number;
    avgPerWeek: number;
    followers: number;
  };
};

const holdings = [
  { asset: "holding-cash.trading.svg", href: "https://cash.trading" },
  { asset: "holding-cash-orderbook.svg", href: "https://github.com/seammoney/cash-orderbook" },
  { asset: "holding-aptos-polymarket.svg", href: "https://aptos-polymarket.vercel.app/polymarket" },
  { asset: "holding-datacenter-globe.svg", href: "https://datacenter-globe.vercel.app" },
  { asset: "holding-terminal-portfolio.svg", href: "https://maxmohammadi.com" },
  { asset: "holding-options-payoff-motion.svg", href: "https://cipher-payoff-atlas.vercel.app" },
  { asset: "holding-ohlone-unicode.svg", href: "https://ohlone-unicode.vercel.app" },
  { asset: "holding-decibel-evolution.svg", href: "https://decibel-presentation.vercel.app" },
  { asset: "holding-NIPAHSCAN.svg", href: "https://nipahscan.vercel.app" },
];

const tabs = ["Performance", "AI Burn", "Holdings"] as const;
type Tab = (typeof tabs)[number];

function GroupBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="tm-group">
      <h3>{label}</h3>
      {children}
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="tm-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const integer = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });

export function StatsApp() {
  const [tab, setTab] = useState<Tab>("Performance");
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(tickerUrl, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((payload) => setTicker(payload.ticker))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const stats = ticker?.stats;
  const value = (format: (ticker: Ticker) => string) => (ticker ? format(ticker) : failed ? "—" : "…");
  const changeLabel = ticker
    ? `${ticker.direction === "up" ? "▲" : "▼"} ${Math.abs(ticker.changePct30d).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`
    : failed
      ? "—"
      : "…";

  return (
    <div className="stats-app">
      <div className="tm-tabs" role="tablist">
        {tabs.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={cn("tm-tab", tab === name && "is-active")}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === "Performance" ? (
        <div className="tm-panel" role="tabpanel">
          <GroupBox label="Commit Velocity — 52 weeks">
            <a className="tm-chart" href={`https://commits.sh/${handle}`} target="_blank" rel="noreferrer">
              <img src={badgeUrl("pro")} alt={`$${handle.toUpperCase()} live velocity chart on commits.sh`} />
            </a>
          </GroupBox>
          <div className="tm-groups">
            <GroupBox label={ticker?.symbol ?? "$MAXMONEYCASH"}>
              <StatRow label="Index price" value={value((t) => `$${t.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`)} />
              <StatRow label="Change (30d)" value={changeLabel} />
              <StatRow label="Market cap" value={value((t) => `$${integer(t.marketCap)}`)} />
            </GroupBox>
            <GroupBox label="Commits (52 weeks)">
              <StatRow label="Total" value={stats ? integer(stats.commits52w) : failed ? "—" : "…"} />
              <StatRow label="Peak week" value={stats ? integer(stats.peakWeek) : failed ? "—" : "…"} />
              <StatRow label="Busiest day" value={stats ? integer(stats.busiestDay) : failed ? "—" : "…"} />
              <StatRow label="Avg / week" value={stats ? stats.avgPerWeek.toLocaleString("en-US", { maximumFractionDigits: 1 }) : failed ? "—" : "…"} />
            </GroupBox>
            <GroupBox label="Activity">
              <StatRow label="Active days" value={stats ? integer(stats.activeDays) : failed ? "—" : "…"} />
              <StatRow label="Longest streak" value={stats ? `${stats.longestStreak} days` : failed ? "—" : "…"} />
              <StatRow label="Current streak" value={stats ? `${stats.currentStreak} days` : failed ? "—" : "…"} />
              <StatRow label="Followers" value={stats ? integer(stats.followers) : failed ? "—" : "…"} />
            </GroupBox>
          </div>
          {ticker ? <p className="tm-analyst">{ticker.analyst}</p> : null}
          {failed ? <p className="tm-analyst">Live stats unavailable right now — charts still stream from commits.sh.</p> : null}
        </div>
      ) : null}

      {tab === "AI Burn" ? (
        <div className="tm-panel" role="tabpanel">
          <GroupBox label="The Burn — live AI usage">
            <a className="tm-chart" href={`https://commits.sh/${handle}/live`} target="_blank" rel="noreferrer">
              <img src={badgeUrl("burn")} alt="Live AI token burn — tokens, value, leverage, by model" />
            </a>
          </GroupBox>
          <GroupBox label="All-time token telemetry">
            <a className="tm-chart" href={`https://github.com/${handle}`} target="_blank" rel="noreferrer">
              <img src={profileAsset("tokens-row.svg")} alt="All-time token receipt and token-ops dashboard" loading="lazy" />
            </a>
          </GroupBox>
          <p className="tm-analyst">
            Streamed hourly from local ccusage + swarm telemetry across Claude Code, Codex, Cursor, and friends.
          </p>
        </div>
      ) : null}

      {tab === "Holdings" ? (
        <div className="tm-panel" role="tabpanel">
          <div className="tm-holdings">
            {holdings.map((holding) => (
              <a key={holding.asset} href={holding.href} target="_blank" rel="noreferrer">
                <img src={profileAsset(holding.asset)} alt={holding.asset.replace(/^holding-|\.svg$/g, "")} loading="lazy" />
              </a>
            ))}
          </div>
          <p className="tm-analyst">Deploy screenshots + 52-week commit velocity per repo — click any card to open the live app.</p>
        </div>
      ) : null}

      <footer className="tm-statusbar">
        <span>Commits: {stats ? integer(stats.commits52w) : "…"}</span>
        <span>
          Velocity: {value((t) => `$${integer(t.price)}`)} {ticker ? changeLabel : ""}
        </span>
        <span>Source: commits.sh</span>
      </footer>
    </div>
  );
}
