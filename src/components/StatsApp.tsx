import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, animate, motion, useReducedMotion } from "framer-motion";
import { cn } from "../lib/cn";
import { easeOut, fadeThrough, motionTransition, press, stagger, staggerItem } from "../lib/motion";

const handle = "maxmoneycash";
const api = (path: string) => `/cm/${path}`;

type ChartSeries = {
  days: { date: string; commits: number }[];
  priceDaily: number[];
};

type ModelUsage = {
  name: string;
  in: number;
  out: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
};

type UsageTokens = {
  total: number;
  cost_usd_total: number;
  live_total: number;
  live_cost_usd: number;
  cache_hit_rate: number;
  apps_used: number;
  models_used: number;
  input_total: number;
  output_total: number;
  cache_read_total: number;
  by_model: ModelUsage[];
};

type TapePoint = { at: number; tokens: number };

type Ticker = {
  symbol: string;
  price: number;
  changePct30d: number;
  direction: "up" | "down";
  marketCap: number;
  analyst: string;
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

const fmtTokens = (n: number) => {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
};

const fmtUsd = (n: number) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

const integer = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

function useAnimatedNumber(target: number, duration = 800) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const from = fromRef.current;
    if (target === from || reduceMotion) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }
    const controls = animate(from, target, {
      duration: duration / 1000,
      ease: easeOut,
      onUpdate: (value) => {
        fromRef.current = value;
        setDisplay(value);
      },
      onComplete: () => { fromRef.current = target; },
    });
    return () => controls.stop();
  }, [target, duration, reduceMotion]);

  return display;
}

/* Live telemetry: one full fetch with the 4h five-second tape, then a light
   poll every 6s that appends to the tape locally. */
function useLiveUsage() {
  const [tokens, setTokens] = useState<UsageTokens | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [tape, setTape] = useState<TapePoint[]>([]);

  useEffect(() => {
    let stopped = false;

    const apply = (payload: {
      connected?: boolean;
      tokens?: UsageTokens;
      history?: { at: number; tokens_total: number }[];
    }) => {
      if (stopped) return;
      setConnected(payload.connected ?? false);
      if (!payload.tokens) return;
      setTokens(payload.tokens);
      if (payload.history) {
        setTape(payload.history.map((point) => ({ at: point.at, tokens: point.tokens_total })));
      } else {
        const live = payload.tokens.live_total;
        setTape((current) => [...current.slice(-2800), { at: Date.now(), tokens: live }]);
      }
    };

    const poll = (withHistory: boolean) =>
      fetch(api(`usage?handle=${handle}${withHistory ? "&history=1" : ""}`))
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then(apply)
        .catch(() => {
          if (!stopped) setConnected((current) => current ?? false);
        });

    void poll(true);
    const interval = window.setInterval(() => {
      if (!document.hidden) void poll(false);
    }, 6000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, []);

  const ratePerSec = useMemo(() => {
    const recent = tape.slice(-6);
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const seconds = (last.at - first.at) / 1000;
    if (seconds <= 0) return 0;
    return Math.max(0, (last.tokens - first.tokens) / seconds);
  }, [tape]);

  return { tokens, connected, tape, ratePerSec };
}

function useCanvas(draw: (context: CanvasRenderingContext2D, width: number, height: number) => void) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(context, rect.width, rect.height);
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  return canvasRef;
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number, step = 16) {
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#003800";
  context.lineWidth = 1;
  for (let x = step; x < width; x += step) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }
  for (let y = step; y < height; y += step) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }
}

/* Commit-velocity candlesticks, computed from the raw priceDaily series the
   commits.sh timeframe selector itself uses. */
function CandleChart({ series }: { series: ChartSeries }) {
  const draw = useCallback(
    (context: CanvasRenderingContext2D, width: number, height: number) => {
      drawGrid(context, width, height);
      const prices = series.priceDaily;
      if (prices.length < 2) return;

      const bucketSize = Math.max(1, Math.ceil(prices.length / 64));
      const candles: { open: number; close: number; high: number; low: number; commits: number }[] = [];
      for (let i = 0; i < prices.length; i += bucketSize) {
        const slice = prices.slice(i, i + bucketSize);
        const commitSlice = series.days.slice(i, i + bucketSize);
        candles.push({
          open: slice[0],
          close: slice[slice.length - 1],
          high: Math.max(...slice),
          low: Math.min(...slice),
          commits: commitSlice.reduce((sum, day) => sum + day.commits, 0),
        });
      }

      const volumeTop = height * 0.82;
      const chartBottom = volumeTop - 6;
      const high = Math.max(...candles.map((candle) => candle.high));
      const low = Math.min(...candles.map((candle) => candle.low));
      const priceSpan = high - low || 1;
      const maxVolume = Math.max(...candles.map((candle) => candle.commits), 1);
      const slot = width / candles.length;
      const bodyWidth = Math.max(2, slot * 0.62);

      const yFor = (price: number) => 8 + (chartBottom - 8) * (1 - (price - low) / priceSpan);

      candles.forEach((candle, index) => {
        const x = index * slot + slot / 2;
        const up = candle.close >= candle.open;
        const color = up ? "#22cf3c" : "#e8452c";

        context.strokeStyle = color;
        context.beginPath();
        context.moveTo(Math.round(x) + 0.5, yFor(candle.high));
        context.lineTo(Math.round(x) + 0.5, yFor(candle.low));
        context.stroke();

        const top = yFor(Math.max(candle.open, candle.close));
        const bodyHeight = Math.max(1, Math.abs(yFor(candle.open) - yFor(candle.close)));
        context.fillStyle = color;
        context.fillRect(Math.round(x - bodyWidth / 2), top, bodyWidth, bodyHeight);

        const volumeHeight = (candle.commits / maxVolume) * (height - volumeTop - 2);
        context.fillStyle = up ? "#0f5c1d" : "#6b2114";
        context.fillRect(Math.round(x - bodyWidth / 2), height - 1 - volumeHeight, bodyWidth, volumeHeight);
      });

      context.fillStyle = "#7fbf7f";
      context.font = "10px 'Tahoma XP', Tahoma, sans-serif";
      context.textAlign = "right";
      context.fillText(integer(high), width - 3, 14);
      context.fillText(integer(low), width - 3, chartBottom - 2);

      context.textAlign = "left";
      const firstDate = series.days[0]?.date;
      const lastDate = series.days[series.days.length - 1]?.date;
      if (firstDate) context.fillText(firstDate, 3, height - 3);
      if (lastDate) {
        context.textAlign = "right";
        context.fillText(lastDate, width - 3, height - 3);
      }
    },
    [series],
  );

  const canvasRef = useCanvas(draw);
  return <canvas ref={canvasRef} className="tm-canvas" role="img" aria-label="Commit velocity candlestick chart" />;
}

/* Token-burn history, drawn like Task Manager's CPU Usage History pane. */
function BurnHistoryChart({ tape }: { tape: TapePoint[] }) {
  const draw = useCallback(
    (context: CanvasRenderingContext2D, width: number, height: number) => {
      drawGrid(context, width, height);
      if (tape.length < 3) {
        context.fillStyle = "#2f8f2f";
        context.font = "11px 'Tahoma XP', Tahoma, sans-serif";
        context.fillText("waiting for telemetry…", 8, height / 2);
        return;
      }

      const rates: number[] = [];
      for (let i = 1; i < tape.length; i++) {
        const seconds = (tape[i].at - tape[i - 1].at) / 1000;
        rates.push(seconds > 0 ? Math.max(0, (tape[i].tokens - tape[i - 1].tokens) / seconds) : 0);
      }
      const windowed = rates.slice(-Math.max(60, Math.min(rates.length, Math.floor(width / 2))));
      const peak = Math.max(...windowed, 1);

      context.beginPath();
      context.moveTo(0, height);
      windowed.forEach((rate, index) => {
        const x = (index / (windowed.length - 1)) * width;
        const y = height - (rate / peak) * (height - 10);
        context.lineTo(x, y);
      });
      context.lineTo(width, height);
      context.closePath();
      context.fillStyle = "rgba(34, 207, 60, 0.22)";
      context.fill();

      context.beginPath();
      windowed.forEach((rate, index) => {
        const x = (index / (windowed.length - 1)) * width;
        const y = height - (rate / peak) * (height - 10);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = "#2eff4e";
      context.lineWidth = 1;
      context.stroke();

      context.fillStyle = "#7fbf7f";
      context.font = "10px 'Tahoma XP', Tahoma, sans-serif";
      context.textAlign = "right";
      context.fillText(`peak ${fmtTokens(peak)}/s`, width - 4, 12);
    },
    [tape],
  );

  const canvasRef = useCanvas(draw);
  return <canvas ref={canvasRef} className="tm-canvas" role="img" aria-label="Token burn history graph" />;
}

function LedGauge({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tm-led">
      <span className="tm-led-label">{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

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

const tabs = ["Performance", "Processes", "Velocity"] as const;
type Tab = (typeof tabs)[number];
const ranges = [
  { key: "3m", label: "3M" },
  { key: "1y", label: "1Y" },
  { key: "max", label: "MAX" },
] as const;

export function StatsApp() {
  const [tab, setTab] = useState<Tab>("Performance");
  const [range, setRange] = useState<(typeof ranges)[number]["key"]>("1y");
  const [series, setSeries] = useState<ChartSeries | null>(null);
  const [seriesFailed, setSeriesFailed] = useState(false);
  const [seriesRequest, setSeriesRequest] = useState(0);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const reduceMotion = useReducedMotion();
  const { tokens, connected, tape, ratePerSec } = useLiveUsage();

  useEffect(() => {
    const controller = new AbortController();
    fetch(api(`v1/ticker/${handle}`), { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((payload) => setTicker(payload.ticker))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSeries(null);
    setSeriesFailed(false);
    fetch(api(`chart?handle=${handle}&range=${range}`), { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then(setSeries)
      .catch(() => {
        if (!controller.signal.aborted) setSeriesFailed(true);
      });
    return () => controller.abort();
  }, [range, seriesRequest]);

  const animatedTotal = useAnimatedNumber(tokens?.total ?? 0);
  const animatedSession = useAnimatedNumber(tokens?.live_total ?? 0);
  const animatedCost = useAnimatedNumber(tokens?.cost_usd_total ?? 0);
  const animatedRate = useAnimatedNumber(ratePerSec, 500);

  const live = connected === true;
  const models = useMemo(
    () => (tokens ? [...tokens.by_model].sort((a, b) => b.cost - a.cost) : []),
    [tokens],
  );
  const maxModelCost = models[0]?.cost ?? 1;

  return (
    <div className="stats-app">
      <LayoutGroup id="stats-tabs">
      <div className="tm-tabs" role="tablist">
        {tabs.map((name) => (
          <motion.button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={cn("tm-tab", tab === name && "is-active")}
            onClick={() => setTab(name)}
            whileTap={press}
            transition={motionTransition.micro}
          >
            {tab === name ? <motion.span className="tm-tab-active" layoutId="tm-tab-active" transition={motionTransition.spatial} /> : null}
            <span>{name}</span>
          </motion.button>
        ))}
        <span className={cn("tm-live-pill", live ? "is-live" : "is-offline")}>
          {live ? "● LIVE" : connected === null ? "○ CONNECTING" : "○ OFFLINE"}
        </span>
      </div>
      </LayoutGroup>

      <AnimatePresence mode="wait" initial={false}>
      {tab === "Performance" ? (
        <motion.div className="tm-panel" role="tabpanel" key="performance" variants={fadeThrough} initial="hidden" animate="visible" exit="exit">
          <div className="tm-perf-top">
            <GroupBox label="Token Rate">
              <div className="tm-meter-box">
                <LedGauge label="TOK / SEC" value={fmtTokens(animatedRate)} sub={live ? "streaming" : "stream idle"} />
              </div>
            </GroupBox>
            <GroupBox label="Burn History — live tape (5s cadence)">
              <div className="tm-canvas-box tm-canvas-tall">
                <BurnHistoryChart tape={tape} />
              </div>
            </GroupBox>
          </div>
          <div className="tm-perf-top">
            <GroupBox label="Session">
              <div className="tm-meter-box">
                <LedGauge
                  label="SESSION TOKENS"
                  value={fmtTokens(animatedSession)}
                  sub={tokens ? `${fmtUsd(tokens.live_cost_usd)} burned` : undefined}
                />
              </div>
            </GroupBox>
            <GroupBox label="All-time">
              <div className="tm-led-row">
                <LedGauge label="TOKENS" value={fmtTokens(animatedTotal)} />
                <LedGauge label="API VALUE" value={fmtUsd(animatedCost)} />
                <LedGauge
                  label="CACHE HIT"
                  value={tokens ? `${(tokens.cache_hit_rate * 100).toFixed(1)}%` : "…"}
                />
              </div>
            </GroupBox>
          </div>
          <div className="tm-groups">
            <GroupBox label="Totals">
              <StatRow label="Input tokens" value={tokens ? fmtTokens(tokens.input_total) : "…"} />
              <StatRow label="Output tokens" value={tokens ? fmtTokens(tokens.output_total) : "…"} />
              <StatRow label="Cache reads" value={tokens ? fmtTokens(tokens.cache_read_total) : "…"} />
            </GroupBox>
            <GroupBox label="Fleet">
              <StatRow label="Coding agents" value={tokens ? integer(tokens.apps_used) : "…"} />
              <StatRow label="Models used" value={tokens ? integer(tokens.models_used) : "…"} />
              <StatRow label="Plan" value="max20" />
            </GroupBox>
          </div>
        </motion.div>
      ) : null}

      {tab === "Processes" ? (
        <motion.div className="tm-panel tm-panel-flush" role="tabpanel" key="processes" variants={fadeThrough} initial="hidden" animate="visible" exit="exit">
          <table className="tm-processes">
            <thead>
              <tr>
                <th>Image Name</th>
                <th>Tokens</th>
                <th>Cost</th>
                <th>Burn %</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model, index) => {
                const modelTokens = model.in + model.out + model.cacheRead + model.cacheWrite;
                return (
                  <motion.tr
                    key={model.name}
                    initial={{ opacity: 0, transform: "translate3d(0, 4px, 0)" }}
                    animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
                    transition={{ ...motionTransition.short, delay: Math.min(index * 0.025, 0.3) }}
                  >
                    <td>{model.name}</td>
                    <td>{fmtTokens(modelTokens)}</td>
                    <td>{model.cost > 0 ? fmtUsd(model.cost) : "—"}</td>
                    <td>
                      <span className="tm-bar" aria-hidden="true">
                        <motion.span
                          initial={{ transform: "scaleX(0)" }}
                          animate={{ transform: `scaleX(${Math.max(0.02, model.cost / maxModelCost)})` }}
                          transition={motionTransition.page}
                        />
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
              {models.length === 0 ? (
                <tr>
                  <td colSpan={4}>{connected === null ? "Loading telemetry…" : "Telemetry offline."}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </motion.div>
      ) : null}

      {tab === "Velocity" ? (
        <motion.div className="tm-panel" role="tabpanel" key="velocity" variants={fadeThrough} initial="hidden" animate="visible" exit="exit">
          <GroupBox label={`${ticker?.symbol ?? "$MAXMONEYCASH"} — commit velocity`}>
            <LayoutGroup id="velocity-ranges">
            <div className="tm-range-row">
              {ranges.map((option) => (
                <motion.button
                  key={option.key}
                  type="button"
                  className={cn("tm-range", range === option.key && "is-active")}
                  onClick={() => setRange(option.key)}
                  whileTap={press}
                  transition={motionTransition.micro}
                >
                  {range === option.key ? <motion.span className="tm-range-active" layoutId="tm-range-active" transition={motionTransition.spatial} /> : null}
                  <span>{option.label}</span>
                </motion.button>
              ))}
              {ticker ? (
                <span className={cn("tm-quote", ticker.direction === "up" ? "is-up" : "is-down")}>
                  ${ticker.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
                  {ticker.direction === "up" ? "▲" : "▼"}{" "}
                  {Math.abs(ticker.changePct30d).toLocaleString("en-US", { maximumFractionDigits: 1 })}% 30d
                </span>
              ) : null}
            </div>
            </LayoutGroup>
            <div className="tm-canvas-box tm-canvas-main">
              {series ? (
                <motion.div className="tm-chart-reveal" variants={fadeThrough} initial="hidden" animate="visible">
                  <CandleChart series={series} />
                </motion.div>
              ) : seriesFailed ? (
                <motion.div className="tm-canvas tm-canvas-error" variants={fadeThrough} initial="hidden" animate="visible">
                  <span>Commit series unavailable.</span>
                  <motion.button
                    type="button"
                    onClick={() => setSeriesRequest((request) => request + 1)}
                    whileTap={press}
                    transition={motionTransition.micro}
                  >
                    Retry
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  className="tm-canvas tm-canvas-loading"
                  animate={reduceMotion ? { opacity: 1 } : { opacity: [0.45, 1, 0.45] }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 1.4, repeat: Infinity, ease: easeOut }}
                >
                  Loading commit series…
                </motion.div>
              )}
            </div>
          </GroupBox>
          <div className="tm-groups">
            <GroupBox label="Commits (52 weeks)">
              <StatRow label="Total" value={ticker ? integer(ticker.stats.commits52w) : "…"} />
              <StatRow label="Peak week" value={ticker ? integer(ticker.stats.peakWeek) : "…"} />
              <StatRow label="Busiest day" value={ticker ? integer(ticker.stats.busiestDay) : "…"} />
              <StatRow label="Avg / week" value={ticker ? ticker.stats.avgPerWeek.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "…"} />
            </GroupBox>
            <GroupBox label="Activity">
              <StatRow label="Active days" value={ticker ? integer(ticker.stats.activeDays) : "…"} />
              <StatRow label="Longest streak" value={ticker ? `${ticker.stats.longestStreak} days` : "…"} />
              <StatRow label="Market cap" value={ticker ? `$${integer(ticker.marketCap)}` : "…"} />
              <StatRow label="Followers" value={ticker ? integer(ticker.stats.followers) : "…"} />
            </GroupBox>
          </div>
          {ticker ? <p className="tm-analyst">{ticker.analyst}</p> : null}
        </motion.div>
      ) : null}
      </AnimatePresence>

      <footer className="tm-statusbar">
        <span>Processes: {tokens ? integer(tokens.models_used) : "…"}</span>
        <span>Burn: {fmtTokens(animatedRate)}/s</span>
        <span>
          Velocity: {ticker ? `$${integer(ticker.price)}` : "…"}{" "}
          {ticker ? (ticker.direction === "up" ? "▲" : "▼") : ""}
        </span>
      </footer>
    </div>
  );
}
