import { useCurrentFrame } from "remotion";
import { easeInOut, easeOut, progress } from "../lib";
import { asset, Camera, Clip, Cursor, Desktop, Sfx, Still, useOrientation, Window } from "../xp";

const CODEX = 2400 / 1463;
const TESTS = 1660 / 1060;
const POPOVER = 952 / 980;

/**
 * Where it all gets built: real terminal sessions on Lilyshark in XP command
 * windows, then commits.sh, a menu-bar app, rises out of the XP tray.
 */
export function DevEnv() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const TESTS_AT = 26;
  const CLICK = 60;
  const RISE = CLICK + 3;

  const codex = portrait
    ? { x: 6, y: 10, w: W - 12, h: Math.round((W - 18) / CODEX) + 33 }
    : { x: 16, y: 12, w: 880, h: Math.round(874 / CODEX) + 33 };
  const tests = portrait
    ? { x: 6, y: 290, w: W - 12, h: Math.round((W - 18) / TESTS) + 33 }
    : { x: 560, y: 220, w: 660, h: Math.round(654 / TESTS) + 33 };
  const pw = portrait ? 400 : 380;
  const ph = Math.round((pw - 6) / POPOVER) + 33;
  const pop = { x: W - pw - 10, y: H - 30 - ph - 6, w: pw, h: ph };
  const rise = 1 - progress(frame, RISE, 10, easeOut);
  const tray = { x: W - 74, y: H - 15 };

  return (
    <Camera
      keys={[
        // Start on the diff, pull back to the two sessions.
        { f: 0, v: { x: codex.x + codex.w * 0.72, y: codex.y + codex.h * 0.36, z: portrait ? 1.9 : 1.9 } },
        { f: 22, v: { x: W / 2, y: H / 2, z: 1 }, ease: easeOut },
        { f: TESTS_AT + 18, v: { x: tests.x + tests.w * 0.3, y: tests.y + tests.h * 0.62, z: portrait ? 1.35 : 1.5 }, ease: easeInOut },
        { f: CLICK - 4, v: { x: W / 2, y: H / 2 + 20, z: 1 }, ease: easeInOut },
        { f: RISE + 16, v: { x: pop.x + pop.w / 2, y: pop.y + pop.h * 0.45, z: portrait ? 1.3 : 1.45 }, ease: easeOut },
        { f: 120, v: { x: pop.x + pop.w / 2, y: pop.y + pop.h * 0.45, z: portrait ? 1.34 : 1.5 } },
      ]}
    >
      <Desktop
        tasks={[
          { title: "cmd.exe - codex", icon: asset("start-menu/cmd.webp"), active: frame < TESTS_AT },
          ...(frame >= TESTS_AT ? [{ title: "cmd.exe - claude", icon: asset("start-menu/cmd.webp"), active: frame < RISE }] : []),
        ]}
      >
        <Window {...codex} title="C:\WINDOWS\system32\cmd.exe - codex ~/lilyshark" icon={asset("start-menu/cmd.webp")} active={frame < TESTS_AT} bodyStyle={{ background: "#000" }}>
          <Still id="dev-codex" />
        </Window>
        {frame >= TESTS_AT ? (
          <Window {...tests} title="C:\WINDOWS\system32\cmd.exe - claude ~/lilyshark/webapp" icon={asset("start-menu/cmd.webp")} active={frame < RISE} bodyStyle={{ background: "#000" }}>
            <Still id="dev-tests" />
          </Window>
        ) : null}
        {frame >= RISE ? (
          <Window
            {...pop}
            title="commits.sh - @maxmoneycash"
            buttons="close"
            bodyStyle={{ background: "#cfe8fb" }}
            style={{ transform: `translateY(${rise * (ph + 40)}px)` }}
          >
            <Clip id="commits-sh-popover" />
          </Window>
        ) : null}
        <Sfx at={TESTS_AT} name="restore" volume={0.4} />
        <Sfx at={CLICK} name="start" volume={0.7} />
        <Sfx at={RISE} name="restore" volume={0.45} />
        <Cursor
          path={[
            { f: 0, v: { x: W * 0.5, y: H * 0.6 } },
            { f: CLICK - 8, v: { x: tray.x, y: tray.y } },
            { f: 120, v: { x: tray.x - 30, y: tray.y - 60 } },
          ]}
          clicks={[CLICK]}
        />
      </Desktop>
    </Camera>
  );
}
