import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { progress } from "../lib";
import { cueAt } from "../morseCue";
import { asset, useOrientation } from "../xp";

/** The "Max xp" wordmark, set like XP's boot logo. */
export function Wordmark({ size = 1, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10 * size }}>
      <Img src={asset("system/windows-flag.webp")} style={{ width: 92 * size, height: 92 * size, marginBottom: 6 * size }} />
      <div style={{ display: "grid", lineHeight: 1 }}>
        <span style={{ font: `700 ${13 * size}px "Trebuchet MS", sans-serif`, color, marginLeft: 3 * size, marginBottom: -2 * size }}>
          Maxwell Mohammadi
        </span>
        <span style={{ display: "flex", alignItems: "flex-start" }}>
          <span style={{ font: `700 ${62 * size}px/1 "Arial Narrow", "Arial", sans-serif`, color, letterSpacing: -1 * size, transform: "scaleX(1.12)", transformOrigin: "0 0", marginRight: 10 * size }}>
            Max
          </span>
          <span style={{ font: `italic 700 ${26 * size}px/1 "Trebuchet MS", sans-serif`, color: "#ff7b16", marginTop: 2 * size }}>xp</span>
        </span>
      </div>
    </div>
  );
}

export function Boot() {
  const frame = useCurrentFrame();
  const { portrait } = useOrientation();
  const appear = progress(frame, 4, 8);
  // Three blue blocks sweep through the bar, as on XP's boot screen.
  const cycle = (frame * 2.4) % 150;
  // The callsign goes out in Morse over the boot screen; the lamp keys with it.
  const morse = cueAt("boot", frame);
  return (
    <AbsoluteFill className="film" style={{ background: "#000", color: "#fff" }}>
      <AbsoluteFill style={{ display: "grid", placeItems: "center", opacity: appear }}>
        <div style={{ display: "grid", justifyItems: "center", gap: portrait ? 70 : 62, marginTop: portrait ? -40 : -10 }}>
          <Wordmark size={portrait ? 1.05 : 1.15} />
          <div
            style={{
              position: "relative",
              width: 150,
              height: 18,
              overflow: "hidden",
              border: "2px solid #b8b8b8",
              borderRadius: 4,
              background: "#000",
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  top: 2,
                  left: cycle - 30 + i * 11,
                  width: 9,
                  height: 10,
                  borderRadius: 1,
                  background: "linear-gradient(180deg, #2f4fe0 0%, #9fb8ff 45%, #3d63ee 55%, #1d36b8 100%)",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: portrait ? -44 : -36, opacity: progress(frame, 10, 6) }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: morse.key ? "#ff3b2f" : "#3a1512",
                boxShadow: morse.key ? "0 0 10px 2px rgb(255 60 40 / 0.85)" : "none",
              }}
            />
            <span style={{ font: '700 15px "Trebuchet MS", sans-serif', letterSpacing: 5, color: "#d8dcff" }}>KK6OQA</span>
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: portrait ? 28 : 48, bottom: portrait ? 34 : 38, fontSize: 12, lineHeight: 1.35, opacity: appear }}>
        Copyright © 1985-2026<br />maxmohammadi.com
      </div>
      <div style={{ position: "absolute", right: portrait ? 28 : 48, bottom: portrait ? 36 : 40, font: "italic 700 20px 'Trebuchet MS'", opacity: appear }}>
        MaxXP
      </div>
    </AbsoluteFill>
  );
}
