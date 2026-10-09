import { random, useCurrentFrame } from "remotion";
import stats from "../stats.json";
import { easeInOut, easeOut } from "../lib";
import { asset, Camera, ClipWindow, Desktop, Sfx, useOrientation, Window, XPButton } from "../xp";

const PROCESSES = [
  ["lilyshark.exe", 412880],
  ["aptos-polymarket.exe", 398432],
  ["commits.sh", 305116],
  ["aptos-move-transpiler.exe", 221904],
  ["cash.trading.exe", 187220],
  ["consensus-visualizer.exe", 164388],
  ["nipahscan.exe", 141120],
  ["orbital-works.exe", 118272],
  ["yank.exe", 104448],
  ["turbotokens.exe", 96512],
  ["tend.exe", 88064],
  ["whop-finance.exe", 81920],
  ["content-rewards.exe", 74240],
  ["shelby-pulse.exe", 71936],
  ["gadgets.sh", 66560],
  ["tx-composer.exe", 64000],
  ["sui-options.exe", 52480],
  ["temper-trade.exe", 42112],
  ["peptide-app.exe", 33280],
  ["coffee.exe", 9600],
] as const;

/** CPU shares that always add to 100, reshuffled a few times a second. */
function cpu(frame: number) {
  const tick = Math.floor(frame / 8);
  const raw = PROCESSES.map((_, i) => (i === PROCESSES.length - 1 ? 0.2 : 0.4 + random(`cpu-${tick}-${i}`) * (i < 6 ? 3 : 1.2)));
  const total = raw.reduce((a, b) => a + b, 0);
  const shares = raw.map((r) => Math.floor((r / total) * 100));
  shares[0] += 100 - shares.reduce((a, b) => a + b, 0);
  return shares;
}

/**
 * XP Task Manager, where "Commit Charge" finally means commits: the real
 * 52-week count from commits.sh. The camera ends on the status bar.
 */
export function TaskManager() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const shares = cpu(frame);
  const tm = portrait ? { x: 8, y: 10, w: W - 16, h: 560 } : { x: 120, y: 14, w: 640, h: 560 };
  const commits = stats.commits52w.toLocaleString("en-US");
  const rows = portrait ? PROCESSES.slice(0, 18) : PROCESSES;
  const statusY = tm.y + tm.h - 17;

  return (
    <Camera
      keys={[
        { f: 0, v: { x: W / 2, y: H / 2, z: 1 } },
        { f: 50, v: { x: W / 2, y: H / 2, z: 1.03 } },
        { f: 62, v: { x: tm.x + tm.w * 0.3, y: statusY - 6, z: portrait ? 2.6 : 3.2 }, ease: easeOut },
        { f: 105, v: { x: tm.x + tm.w * 0.72, y: statusY - 6, z: portrait ? 2.7 : 3.3 }, ease: easeInOut },
      ]}
    >
      <Desktop tasks={[{ title: "MaxXP Task Manager", icon: asset("start-menu/cmd.webp"), active: true }, { title: "commits.sh" }]}>
        <Sfx at={0} name="restore" volume={0.35} />
        <Sfx at={60} name="ding" volume={0.4} />
        <ClipWindow
          id="commits-sh-menubar"
          title="commits.sh - @maxmoneycash"
          {...(portrait ? { x: 70, y: 540, w: 400, h: 350 } : { x: 790, y: 40, w: 440, h: 560 })}
          active={false}
          from={0.2}
        />
        <Window
          {...tm}
          title="MaxXP Task Manager"
          icon={asset("start-menu/cmd.webp")}
          chrome={{ menu: ["File", "Options", "View", "Shut Down", "Help"] }}
          bodyStyle={{ background: "#ece9d8", padding: "8px 8px 0" }}
        >
          <div style={{ display: "flex", gap: 1, fontSize: 11 }}>
            {["Applications", "Processes", "Performance", "Networking", "Users"].map((tab) => (
              <span
                key={tab}
                style={{
                  padding: tab === "Processes" ? "4px 9px 5px" : "3px 8px",
                  border: "1px solid #919b9c",
                  borderBottom: tab === "Processes" ? "1px solid #fcfcfe" : undefined,
                  borderRadius: "3px 3px 0 0",
                  background: tab === "Processes" ? "#fcfcfe" : "linear-gradient(180deg, #fff, #ecebe5)",
                  boxShadow: tab === "Processes" ? "inset 0 2px #ffc83c" : undefined,
                  marginBottom: -1,
                  position: "relative",
                }}
              >
                {tab}
              </span>
            ))}
          </div>
          <div style={{ border: "1px solid #919b9c", background: "#fcfcfe", padding: 8, height: tm.h - 30 - 21 - 21 - 8 - 26 - 30 }}>
            <div style={{ border: "1px solid #7f9db9", background: "#fff", height: "100%", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 40px 90px", background: "linear-gradient(180deg, #fff, #ebeadb)", borderBottom: "1px solid #d6d2c2", fontSize: 11 }}>
                {["Image Name", "User Name", "CPU", "Mem Usage"].map((c, i) => (
                  <span key={c} style={{ padding: "4px 6px", borderRight: "1px solid #d6d2c2", textAlign: i >= 2 ? "right" : "left" }}>{c}</span>
                ))}
              </div>
              {rows.map(([name, mem], i) => (
                <div
                  key={name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 70px 40px 90px",
                    fontSize: 11,
                    lineHeight: "17px",
                    background: i === 0 ? "#316ac5" : undefined,
                    color: i === 0 ? "#fff" : "#000",
                  }}
                >
                  <span style={{ padding: "0 6px" }}>{name}</span>
                  <span style={{ padding: "0 6px" }}>max</span>
                  <span style={{ padding: "0 6px", textAlign: "right" }}>{String(shares[i]).padStart(2, "0")}</span>
                  <span style={{ padding: "0 6px", textAlign: "right" }}>{mem.toLocaleString("en-US")} K</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 2px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 13, height: 13, border: "1px solid #1c5180", background: "#fff", display: "grid", placeItems: "center", fontSize: 11, lineHeight: 1 }}>✓</span>
              Show processes from all users
            </span>
            <XPButton>End Process</XPButton>
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              display: "grid",
              gridTemplateColumns: portrait ? "0.8fr 1fr 1.6fr" : "0.9fr 1fr 1.7fr",
              borderTop: "1px solid #d8d2bd",
              fontSize: 11,
              background: "#ece9d8",
            }}
          >
            <span style={{ padding: "4px 6px", borderRight: "1px solid #c7c2a9" }}>Processes: {PROCESSES.length}</span>
            <span style={{ padding: "4px 6px", borderRight: "1px solid #c7c2a9" }}>CPU Usage: 100%</span>
            <span style={{ padding: "4px 6px" }}>Commit Charge: <b>{commits}</b> / 52 wk</span>
          </div>
        </Window>
      </Desktop>
    </Camera>
  );
}
