import { useCurrentFrame } from "remotion";
import { beats } from "../beat";
import { easeInOut, easeOut, progress } from "../lib";
import { asset, Camera, Clip, Cursor, Desktop, Sfx, shotOf, Still, useOrientation, wide, Window } from "../xp";

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
  const TESTS_AT = beats(2);
  const RISE = beats(5);
  const CLICK = RISE - 3;

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
        { f: 0, v: shotOf(codex, W, H, portrait) },
        { f: TESTS_AT, v: shotOf(codex, W, H, portrait) },
        { f: TESTS_AT + 10, v: shotOf(tests, W, H, portrait), ease: easeOut },
        { f: CLICK - 4, v: wide(W, H), ease: easeInOut },
        { f: RISE + 12, v: shotOf(pop, W, H, portrait), ease: easeOut },
      ]}
    >
      <Desktop
        tasks={[
          { title: "cmd.exe - codex", icon: asset("start-menu/cmd.webp"), active: frame < TESTS_AT },
          ...(frame >= TESTS_AT ? [{ title: "cmd.exe - claude", icon: asset("start-menu/cmd.webp"), active: frame < RISE }] : []),
        ]}
      >
        <Window {...codex} appear={0} title="C:\WINDOWS\system32\cmd.exe - codex ~/lilyshark" icon={asset("start-menu/cmd.webp")} active={frame < TESTS_AT} bodyStyle={{ background: "#000" }}>
          <Still id="dev-codex" />
        </Window>
        {frame >= TESTS_AT ? (
          <Window {...tests} appear={TESTS_AT} title="C:\WINDOWS\system32\cmd.exe - claude ~/lilyshark/webapp" icon={asset("start-menu/cmd.webp")} active={frame < RISE} bodyStyle={{ background: "#000" }}>
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
            { f: beats(8), v: { x: tray.x - 30, y: tray.y - 60 } },
          ]}
          clicks={[CLICK]}
        />
      </Desktop>
    </Camera>
  );
}
