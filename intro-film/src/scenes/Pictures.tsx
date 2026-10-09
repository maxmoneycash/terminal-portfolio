import { Img, staticFile, useCurrentFrame } from "remotion";
import stillManifest from "../../stills.json";
import { easeOut, progress } from "../lib";
import { asset, Camera, Cursor, Desktop, Sfx, Still, useOrientation, Window } from "../xp";

type StillId = keyof typeof stillManifest.stills;
const STILLS = stillManifest.stills;

/** The slideshow: one screenshot per project. */
const SHOW: StillId[] = [
  "lilyshark-traffic",
  "commits-sh-card",
  "tend-home",
  "cash-trading-btc",
  "content-rewards",
  "whop-finance",
  "turbotokens",
  "tx-composer",
  "aptos-archon",
  "tend-app",
  "cash-trading-aapl",
  "whop-finance-sdk",
  "commits-sh-home",
];
const THUMBS = Object.keys(STILLS) as StillId[];
const OPEN = 44; // the viewer opens
const EVERY = 9; // frames per picture

/** Windows Picture and Fax Viewer's bottom bar of round buttons. */
export function ViewerToolbar({ small = false, pressed = -1 }: { small?: boolean; pressed?: number }) {
  const size = small ? 20 : 26;
  const groups = [2, 2, 2, 2, 3];
  let k = 0;
  return (
    <div style={{ height: small ? 34 : 44, flex: "none", display: "flex", justifyContent: "center", alignItems: "center", gap: small ? 10 : 16, background: "linear-gradient(180deg, #f4f3ee, #dcd9c8)", borderTop: "1px solid #c3bfa8" }}>
      {groups.map((n, g) => (
        <div key={g} style={{ display: "flex", gap: small ? 3 : 5 }}>
          {Array.from({ length: n }, () => {
            const i = k++;
            const isNext = i === 1;
            return (
              <span
                key={i}
                style={{
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  border: "1px solid #7f9db9",
                  background: i === pressed
                    ? "radial-gradient(circle at 50% 40%, #b9d3ff, #5d8fe0)"
                    : isNext || i === 0
                      ? "radial-gradient(circle at 50% 35%, #fff, #8cc06f 70%, #3f8f2a)"
                      : "radial-gradient(circle at 50% 35%, #fff, #c9d8f1 75%, #8aa6d6)",
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function TaskPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 12, borderRadius: "4px 4px 0 0", overflow: "hidden" }}>
      <div style={{ padding: "6px 10px", background: "linear-gradient(90deg, #fff, #c6d3f7)", color: "#215dc6", fontWeight: 700, fontSize: 11 }}>{title}</div>
      <div style={{ padding: "8px 10px", background: "#d6dff7", display: "grid", gap: 7, fontSize: 11, color: "#215dc6" }}>
        {items.map((item) => (
          <span key={item} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: "linear-gradient(135deg, #8fb8ff, #3c6fd8)" }} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * My Pictures in Thumbnails view fills with screenshots of every app, then
 * "View as a slide show" flips through them in the picture viewer.
 */
export function Pictures() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const cols = portrait ? 3 : 6;
  const cellW = portrait ? 172 : 170;
  const cellH = portrait ? 146 : 150;
  const pane = portrait ? 0 : 200;
  const gridX = pane + 14;
  const gridY = 12;
  const viewerOpen = frame >= OPEN;
  const shown = Math.min(SHOW.length - 1, Math.max(0, Math.floor((frame - OPEN - 4) / EVERY)));
  const id = SHOW[shown];
  const local = frame - OPEN - 4 - shown * EVERY;
  const pop = progress(local, 0, 3, easeOut);

  // "View as a slide show" link in the task pane (landscape), or the first thumbnail.
  const chromeTop = 30 + 21 + 38 + 25;
  const target = portrait
    ? { x: gridX + cellW / 2, y: chromeTop + gridY + 50 }
    : { x: 40, y: chromeTop + 14 + 30 };

  return (
    <Camera
      keys={[
        { f: 0, v: { x: W / 2, y: H / 2, z: 1.04 } },
        { f: OPEN, v: { x: W / 2, y: H / 2, z: 1 } },
        { f: 170, v: { x: W / 2, y: H / 2 - 10, z: 1.06 }, ease: easeOut },
      ]}
    >
      <Desktop tasks={[{ title: viewerOpen ? "Windows Picture and Fax Viewer" : "My Pictures", icon: asset(viewerOpen ? "start-menu/photos.webp" : "toolbar/folder.webp"), active: true }]}>
        {!viewerOpen ? (
          <Window
            x={0}
            y={0}
            w={W}
            h={H - 30}
            style={{ borderRadius: 0 }}
            titleStyle={{ borderRadius: 0 }}
            title="My Pictures"
            icon={asset("toolbar/folder.webp")}
            chrome={{
              menu: ["File", "Edit", "View", "Favorites", "Tools", "Help"],
              toolbar: true,
              address: "C:\\Documents and Settings\\Max\\My Documents\\My Pictures",
              status: `${THUMBS.length} objects`,
            }}
          >
            {pane ? (
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pane, padding: 12, background: "linear-gradient(180deg, #7ba2e7, #6375d6)" }}>
                <TaskPanel title="Picture Tasks" items={["View as a slide show", "Order prints online", "Print pictures", "Copy all items to CD"]} />
                <TaskPanel title="File and Folder Tasks" items={["Rename this folder", "Publish this folder", "Share this folder"]} />
              </div>
            ) : null}
            {THUMBS.map((still, i) => {
              const at = 3 + i * 1.6;
              if (frame < at) return null;
              const x = gridX + (i % cols) * cellW;
              const y = gridY + Math.floor(i / cols) * cellH;
              const selected = portrait ? i === 0 && frame >= 30 : false;
              return (
                <div key={still} style={{ position: "absolute", left: x, top: y, width: cellW - 12, display: "grid", justifyItems: "center", gap: 5, opacity: progress(frame, at, 3) }}>
                  <div style={{ position: "relative", width: cellW - 24, height: cellH - 46, border: `1px solid ${selected ? "#316ac5" : "#d4d0c8"}`, background: "#fff", boxShadow: "1px 1px 0 #ece9d8" }}>
                    <Img src={staticFile(`stills/${still}.jpg`)} style={{ position: "absolute", inset: 4, width: "calc(100% - 8px)", height: "calc(100% - 8px)", objectFit: "contain" }} />
                  </div>
                  <span style={{ fontSize: 11, padding: "0 3px", maxWidth: cellW - 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: selected ? "#316ac5" : undefined, color: selected ? "#fff" : "#000" }}>
                    {STILLS[still].title}
                  </span>
                </div>
              );
            })}
          </Window>
        ) : (
          <Window
            x={0}
            y={0}
            w={W}
            h={H - 30}
            style={{ borderRadius: 0 }}
            titleStyle={{ borderRadius: 0 }}
            title={`${STILLS[id].title} - Windows Picture and Fax Viewer`}
            icon={asset("start-menu/photos.webp")}
            bodyStyle={{ background: "#fff", display: "flex", flexDirection: "column" }}
          >
            <div style={{ position: "relative", flex: 1, margin: portrait ? 0 : 14, transform: `scale(${0.97 + 0.03 * pop})`, opacity: 0.75 + 0.25 * pop }}>
              {/* Phones fill the tall viewer, keeping each app's left-hand headline. */}
              <Still id={id} fit={portrait ? "cover" : "contain"} position={portrait ? "22% 50%" : "50% 50%"} />
            </div>
            <ViewerToolbar pressed={local < 3 && shown > 0 ? 1 : -1} small={portrait} />
          </Window>
        )}
        {SHOW.map((_, i) => (i > 0 ? <Sfx key={i} at={OPEN + 4 + i * EVERY} name="menu" volume={0.35} /> : null))}
        <Sfx at={OPEN - 4} name="start" volume={0.6} />
        {!viewerOpen ? (
          <Cursor
            path={[
              { f: 0, v: { x: W * 0.7, y: H * 0.7 } },
              { f: 34, v: { x: target.x + 30, y: target.y + 4 } },
            ]}
            clicks={[OPEN - 4]}
          />
        ) : null}
      </Desktop>
    </Camera>
  );
}

export const PICTURES_FRAMES = OPEN + 4 + SHOW.length * EVERY + 6;
