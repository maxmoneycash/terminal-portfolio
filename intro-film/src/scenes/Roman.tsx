import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { beats } from "../beat";
import { easeInOut, easeOut, progress } from "../lib";
import { asset, Clip, Cursor, Desktop, Sfx, useOrientation, Window, XPButton } from "../xp";

const SAVER = beats(2); // the screen saver starts on beat 2
const PREVIEW = SAVER - 2; // the cursor presses Preview just before
/** Shots from the Orbital Works film, cut on the beat. */
const SHOTS = [
  { id: "roman-closeup", at: beats(2) },
  { id: "roman-earth", at: beats(6) },
  { id: "roman-apart", at: beats(10) },
  { id: "roman-wheel", at: beats(13) },
] as const;

/** XP's Starfield screen saver, behind Orbital Works' telescope. */
function Starfield({ frame, W, H }: { frame: number; W: number; H: number }) {
  const stars = Array.from({ length: 140 }, (_, i) => {
    const angle = random(`a${i}`) * Math.PI * 2;
    const speed = 0.004 + random(`s${i}`) * 0.012;
    const d = ((random(`d${i}`) + frame * speed) % 1) ** 2;
    const r = Math.hypot(W, H) * 0.55 * d;
    return { x: W / 2 + Math.cos(angle) * r, y: H / 2 + Math.sin(angle) * r, size: 0.6 + d * 2.4, alpha: 0.25 + d * 0.75 };
  });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {stars.map((s, i) => (
        <span key={i} style={{ position: "absolute", left: s.x, top: s.y, width: s.size, height: s.size, borderRadius: "50%", background: `rgb(255 255 255 / ${s.alpha})` }} />
      ))}
    </AbsoluteFill>
  );
}

function Tabs({ active }: { active: string }) {
  return (
    <div style={{ display: "flex", gap: 1 }}>
      {["Themes", "Desktop", "Screen Saver", "Appearance", "Settings"].map((tab) => (
        <span
          key={tab}
          style={{
            padding: tab === active ? "4px 8px 5px" : "3px 7px",
            border: "1px solid #919b9c",
            borderBottom: tab === active ? "1px solid #fcfcfe" : undefined,
            borderRadius: "3px 3px 0 0",
            background: tab === active ? "#fcfcfe" : "linear-gradient(180deg, #fff, #ecebe5)",
            boxShadow: tab === active ? "inset 0 2px #ffc83c" : undefined,
            marginBottom: -1,
            position: "relative",
          }}
        >
          {tab}
        </span>
      ))}
    </div>
  );
}

/** The little CRT in Display Properties, previewing the screen saver. */
function Monitor({ w }: { w: number }) {
  const sw = w - 28;
  return (
    <div style={{ display: "grid", justifyItems: "center" }}>
      <div style={{ width: w, padding: 10, borderRadius: 8, background: "linear-gradient(180deg, #e8e6dc, #c9c5b4)", border: "1px solid #8c887a" }}>
        <div style={{ position: "relative", width: sw, height: Math.round(sw * 0.62), background: "#000", border: "2px solid #6d6a5f", overflow: "hidden" }}>
          <Clip id="roman-earth" thumb fit="cover" />
        </div>
      </div>
      <div style={{ width: w * 0.22, height: 10, background: "linear-gradient(180deg, #c9c5b4, #a9a596)" }} />
      <div style={{ width: w * 0.5, height: 8, borderRadius: "4px 4px 2px 2px", background: "linear-gradient(180deg, #d6d3c6, #a9a596)" }} />
    </div>
  );
}

/**
 * Display Properties → Screen Saver → "Orbital Works", then Preview: the
 * Nancy Grace Roman Space Telescope from orbital-works, over a starfield.
 */
export function Roman() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const dw = portrait ? 420 : 410;
  const dh = 470;
  const dx = (W - dw) / 2;
  const dy = portrait ? 150 : (H - 30 - dh) / 2;
  const previewBtn = { x: dx + dw - 70, y: dy + 268 };

  if (frame < SAVER) {
    return (
      <Desktop tasks={[{ title: "Display Properties", icon: asset("desktop/display.png"), active: true }]}>
        <Window
          x={dx}
          y={dy}
          w={dw}
          h={dh}
          appear={0}
          title="Display Properties"
          icon={asset("desktop/display.png")}
          buttons="close"
          bodyStyle={{ background: "#ece9d8", padding: "8px 8px 0", fontSize: 11 }}
        >
          <Tabs active="Screen Saver" />
          <div style={{ border: "1px solid #919b9c", background: "#fcfcfe", padding: "14px 12px", height: 382 }}>
            <Monitor w={210} />
            <fieldset style={{ marginTop: 12, border: "1px solid #d0d0bf", borderRadius: 3, padding: "6px 10px 10px" }}>
              <legend style={{ color: "#0046d5", padding: "0 3px" }}>Screen saver</legend>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, height: 21, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 0 5px", border: "1px solid #7f9db9", background: "#fff" }}>
                  Orbital Works: Roman
                  <span style={{ width: 17, height: 19, display: "grid", placeItems: "center", background: "linear-gradient(180deg, #c6d7fb, #9db9f2)", borderLeft: "1px solid #b0c4f0" }}>
                    <svg width="8" height="5" viewBox="0 0 8 5"><path d="M0 0 L4 4 L8 0" fill="none" stroke="#4d6185" strokeWidth="1.6" /></svg>
                  </span>
                </span>
                <XPButton>Settings</XPButton>
                <XPButton state={frame >= PREVIEW ? "pressed" : frame >= PREVIEW - 8 ? "hot" : undefined}>Preview</XPButton>
              </div>
              <div style={{ marginTop: 9 }}>Wait: <span style={{ border: "1px solid #7f9db9", padding: "1px 6px", background: "#fff" }}>1</span> minutes</div>
            </fieldset>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, padding: "8px 0" }}>
            <XPButton>OK</XPButton>
            <XPButton>Cancel</XPButton>
            <XPButton>Apply</XPButton>
          </div>
        </Window>
        <Sfx at={PREVIEW} name="start" volume={0.7} />
        <Cursor
          path={[
            { f: 0, v: { x: W * 0.7, y: H * 0.78 } },
            { f: PREVIEW - 6, v: { x: previewBtn.x, y: previewBtn.y } },
          ]}
          clicks={[PREVIEW]}
        />
      </Desktop>
    );
  }

  // The film is 16:9: it fills a landscape frame exactly; on a phone it spans
  // the width with the starfield above and the caption below.
  const filmH = portrait ? Math.round(W / (16 / 9)) : H;
  const filmY = portrait ? Math.round((H - filmH) / 2) - 60 : 0;
  const caption = progress(frame, SAVER + 8, 10, easeOut);
  return (
    <AbsoluteFill className="film" style={{ background: "#000", overflow: "hidden" }}>
      <Starfield frame={frame} W={W} H={H} />
      {SHOTS.map((shot, i) => {
        const next = SHOTS[i + 1]?.at ?? 1e9;
        if (frame < shot.at || frame >= next + 4) return null;
        const t = progress(frame, shot.at, next === 1e9 ? beats(3) : next - shot.at, easeInOut);
        const fadeIn = i === 0 ? progress(frame, shot.at, 6) : 1;
        return (
          <div key={shot.id} style={{ position: "absolute", left: 0, top: filmY, width: W, height: filmH, overflow: "hidden", opacity: fadeIn }}>
            <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + 0.03 * t})` }}>
              <Clip id={shot.id} />
            </div>
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          ...(portrait ? { top: filmY + filmH + 34 } : { bottom: 26 }),
          textAlign: "center",
          color: "#fff",
          opacity: caption,
          textShadow: "0 2px 8px #000",
        }}
      >
        <div style={{ font: `700 ${portrait ? 24 : 26}px "Trebuchet MS", sans-serif`, letterSpacing: 0.3 }}>Nancy Grace Roman Space Telescope</div>
        <div className="mono" style={{ marginTop: 6, fontSize: portrait ? 13 : 14, color: "#9df58c" }}>orbital works · 1,374,306 km from Earth · signal delay 4.58 s</div>
      </div>
    </AbsoluteFill>
  );
}
