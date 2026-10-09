import { useCurrentFrame } from "remotion";
import { caretVisible, easeOut, typed } from "../lib";
import { asset, Camera, Desktop, useOrientation, Window } from "../xp";

export const NOTEPAD_LINES = "make it faster\nno, the other chain\nship it";

/** The film's lyric sheet: a late-night Notepad, typed while the camera leans in. */
export function Notepad() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const text = typed(NOTEPAD_LINES, frame, 10, 15);
  const box = portrait ? { x: 14, y: 120, w: W - 28, h: 600 } : { x: 150, y: 60, w: 980, h: 540 };
  const fontSize = portrait ? 25 : 34;

  return (
    <Camera
      keys={[
        { f: 0, v: { x: W / 2, y: H / 2, z: 1 } },
        { f: 110, v: { x: box.x + box.w * 0.42, y: box.y + box.h * 0.34, z: portrait ? 1.28 : 1.45 }, ease: easeOut },
      ]}
    >
      <Desktop tasks={[{ title: "we shipped every night.txt - Notepad", icon: asset("start-menu/notepad.webp"), active: true }]}>
        <Window
          {...box}
          title="we shipped every night.txt - Notepad"
          icon={asset("start-menu/notepad.webp")}
          chrome={{ menu: ["File", "Edit", "Format", "View", "Help"] }}
          bodyStyle={{ border: "1px solid #7f9db9", borderRight: 0 }}
        >
          <div className="mono" style={{ padding: "8px 12px", fontSize, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
            {text}
            <span style={{ display: "inline-block", width: 2, height: fontSize * 1.05, marginLeft: 1, verticalAlign: "text-bottom", background: "#000", opacity: caretVisible(frame) ? 1 : 0 }} />
          </div>
          <Scrollbar />
        </Window>
      </Desktop>
    </Camera>
  );
}

/** XP's empty vertical scrollbar, which every Notepad shows. */
export function Scrollbar() {
  const arrow = (up: boolean) => (
    <div style={{ height: 17, borderRadius: 3, background: "linear-gradient(90deg, #c8d6fb, #b6c9f7)", border: "1px solid #a8bbe8", display: "grid", placeItems: "center" }}>
      <svg width="8" height="5" viewBox="0 0 8 5">
        <path d={up ? "M0 5 L4 1 L8 5" : "M0 0 L4 4 L8 0"} fill="none" stroke="#4d6185" strokeWidth="1.6" />
      </svg>
    </div>
  );
  return (
    <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 17, display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f4f3ee", borderLeft: "1px solid #ece9d8" }}>
      {arrow(true)}
      {arrow(false)}
    </div>
  );
}
