import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeOut, progress } from "../lib";
import { Cursor, Sfx, useOrientation } from "../xp";
import { Wordmark } from "./Boot";
import { ALL_DEMOS } from "./Flood";

/** XP's account picture: an emoji on a lit tile with the white Luna frame. */
export function UserTile({ glyph, size, selected, sky = "#9fd2ff" }: { glyph: string; size: number; selected?: boolean; sky?: string }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        width: size,
        height: size,
        flex: "none",
        border: `${Math.max(2, size / 34)}px solid ${selected ? "#f7a14b" : "#fff"}`,
        borderRadius: size / 14,
        background: `linear-gradient(180deg, ${sky}, #fff7d8)`,
        boxShadow: selected ? "0 0 0 2px rgb(255 190 110 / 0.7), 0 0 18px rgb(255 160 60 / 0.75)" : "0 2px 6px rgb(0 0 0 / 0.3)",
        fontSize: size * 0.62,
        lineHeight: 1,
      }}
    >
      {glyph}
    </div>
  );
}

/** The kinetic "welcome" type: words land one at a time. */
export function WelcomeWords({ words, at, every = 9, size = 64, align = "left", style }: {
  words: string[];
  at: number;
  every?: number;
  size?: number;
  align?: "left" | "right" | "center";
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  return (
    <div className="welcome-type" style={{ fontSize: size, textAlign: align, ...style }}>
      {words.map((word, i) => {
        const start = at + i * every;
        if (frame < start) return null;
        const t = progress(frame, start, 5, easeOut);
        return (
          <span key={i} style={{ display: "inline-block", transform: `translateY(${(1 - t) * size * 0.12}px) scale(${0.96 + 0.04 * t})`, opacity: 0.3 + 0.7 * t }}>
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
}

export function LoginFrame({ children, portrait }: { children?: React.ReactNode; portrait: boolean }) {
  const top = portrait ? 96 : 92;
  const bottom = portrait ? 96 : 98;
  return (
    <AbsoluteFill className="film" style={{ background: "#5a7edc", color: "#fff", overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(60% 55% at 12% 22%, rgb(160 186 245 / 0.75), transparent 70%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: top, background: "#00309c" }} />
      <div style={{ position: "absolute", top, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #3c66d0, #e8eeff 30%, #9fb6ee 60%, #3c66d0)" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: bottom, background: "linear-gradient(90deg, #3a2f9f, #2f3cb1 55%, #2536a8)" }} />
      <div style={{ position: "absolute", bottom, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #2f3cb1, #f99d4c 32%, #f08a3c 55%, #2f3cb1)" }} />
      {children}
    </AbsoluteFill>
  );
}

function TurnOff({ portrait }: { portrait: boolean }) {
  return (
    <>
      <div style={{ position: "absolute", left: portrait ? 22 : 32, bottom: portrait ? 34 : 34, display: "flex", alignItems: "center", gap: 10, fontSize: 15 }}>
        <span style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 4, background: "linear-gradient(180deg, #f2763f, #c9381d)", border: "1px solid #fff" }}>
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M5 4.5 A5 5 0 1 0 11 4.5" fill="none" stroke="#fff" strokeWidth="2" />
            <path d="M8 1.5 V8" stroke="#fff" strokeWidth="2" />
          </svg>
        </span>
        Turn off computer
      </div>
      {portrait ? null : (
        <div style={{ position: "absolute", right: 34, bottom: 26, textAlign: "right", fontSize: 12, lineHeight: 1.5 }}>
          After you log on, every window is a real project.
          <div style={{ fontSize: 17 }}>Recordings, screenshots and code from this machine.</div>
        </div>
      )}
    </>
  );
}

function UserRow({ glyph, name, detail, size, selected, sky, x, y, w }: {
  glyph: string;
  name: string;
  detail: string;
  size: number;
  selected: boolean;
  sky?: string;
  x: number;
  y: number;
  w: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        display: "flex",
        alignItems: "center",
        gap: size * 0.16,
        padding: size * 0.06,
        borderRadius: size * 0.08,
        background: selected ? "linear-gradient(90deg, #2552c4 0%, #2e5fd0 55%, rgb(46 95 208 / 0))" : "transparent",
      }}
    >
      <UserTile glyph={glyph} size={size} selected={selected} sky={sky} />
      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: size * 0.3, textShadow: "0 1px 2px rgb(0 0 0 / 0.35)" }}>{name}</span>
        <span style={{ fontSize: size * 0.16, color: "#dfe8ff" }}>{detail}</span>
      </div>
    </div>
  );
}

/**
 * The XP Welcome screen. The cursor picks Max, the other account fades, and
 * "welcome back." lands where the instruction was.
 */
export function Login() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const CLICK = 30;
  const picked = frame >= CLICK;
  const otherFade = 1 - progress(frame, CLICK + 2, 8);
  const loading = picked ? "Loading your personal settings..." : `${ALL_DEMOS.length} programs running`;

  if (portrait) {
    const tile = 84;
    return (
      <LoginFrame portrait>
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "grid", justifyItems: "center", gap: 18 }}>
          <Wordmark size={0.82} />
          <span style={{ fontSize: 17 }}>To begin, click your user name</span>
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 330, height: 1, background: "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.6), transparent)" }} />
        <div style={{ opacity: otherFade }}>
          <UserRow glyph="🐤" name="You" detail="Guest" size={tile} selected={false} x={56} y={372} w={430} />
        </div>
        <UserRow glyph="🚀" name="Max" detail={loading} size={picked ? 112 : tile} selected={picked} sky="#7fc0ff" x={56} y={picked ? 470 : 488} w={430} />
        <WelcomeWords words={["welcome", "back."]} at={CLICK + 10} size={56} align="center" style={{ position: "absolute", left: 0, right: 0, top: 690 }} />
        <TurnOff portrait />
        <Sfx at={CLICK} name="start" volume={0.7} />
        <Cursor
          path={[
            { f: 0, v: { x: 420, y: 820 } },
            { f: 24, v: { x: 120, y: 528 } },
          ]}
          clicks={[CLICK]}
        />
      </LoginFrame>
    );
  }

  const tile = 78;
  return (
    <LoginFrame portrait={false}>
      <div style={{ position: "absolute", left: W / 2 - 1, top: 130, width: 1, height: H - 130 - 140, background: "linear-gradient(180deg, transparent, rgb(255 255 255 / 0.55), transparent)" }} />
      <div style={{ position: "absolute", right: W / 2 + 34, top: 196, display: "grid", justifyItems: "end", gap: 22 }}>
        <Wordmark size={0.95} />
        <span style={{ fontSize: 19, marginTop: 6 }}>To begin, click your user name</span>
      </div>
      <WelcomeWords words={["welcome", "back."]} at={CLICK + 10} size={66} align="right" style={{ position: "absolute", right: W / 2 + 34, top: 386 }} />
      <div style={{ opacity: otherFade }}>
        <UserRow glyph="🐤" name="You" detail="Guest" size={tile} selected={false} x={W / 2 + 30} y={214} w={520} />
      </div>
      <UserRow
        glyph="🚀"
        name="Max"
        detail={loading}
        size={picked ? 150 : tile}
        selected={picked}
        sky="#7fc0ff"
        x={W / 2 + 30}
        y={picked ? 300 : 330}
        w={560}
      />
      <TurnOff portrait={false} />
      <Sfx at={CLICK} name="start" volume={0.7} />
      <Cursor
        path={[
          { f: 0, v: { x: 1010, y: 640 } },
          { f: 24, v: { x: W / 2 + 92, y: 372 } },
          { f: 40, v: { x: W / 2 + 140, y: 300 } },
        ]}
        clicks={[CLICK]}
      />
    </LoginFrame>
  );
}
