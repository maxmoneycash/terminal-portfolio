/**
 * The work, best first. Each project is one chapter: its windows open on the
 * downbeat, share the project's name in their titles and taskbar button, and
 * minimize together before the next project opens, so it is always clear
 * which recordings belong together.
 */
import { useContext } from "react";
import { Sequence, useCurrentFrame } from "remotion";
import { mediaLayout, storyLayout } from "../mediaLayout";
import { BAR, BEAT } from "../beat";
import { AppWindow, asset, Clip, clipRatio, Desktop, Montage, SceneStart, Still, stillRatio, useOrientation, type Enter } from "../xp";
import score from "../../score.json";
import type clipManifest from "../../clips.json";
import type stillManifest from "../../stills.json";

type ClipId = keyof typeof clipManifest.clips;
type StillId = keyof typeof stillManifest.stills;

/** Window chrome heights: title bar + frame, and IE's address bar. */
const TITLE = 33;
const ADDRESS = 25;
const IE = asset("desktop/projects.webp");
const PLAYER = asset("start-menu/mediaPlayer.webp");

type Body =
  | { clip: ClipId; from?: number }
  | { still: StillId }
  | { montage: { id: ClipId; at: number }[] };

type Pane = {
  body: Body;
  title: string;
  /** Internet Explorer with this address. */
  url?: string;
  at?: number;
  enter?: Enter;
};

function ratioOf(body: Body) {
  if ("clip" in body) return clipRatio(body.clip);
  if ("still" in body) return stillRatio(body.still);
  return clipRatio(body.montage[0].id);
}

/** Films play in Media Player; sites and apps get MaxXP's project icon. */
const iconOf = (pane: Pane) => ("montage" in pane.body ? PLAYER : IE);

function Content({ body, until }: { body: Body; until: number }) {
  if ("clip" in body) return <Clip id={body.clip} from={body.from ?? 0} />;
  if ("still" in body) return <Still id={body.still} />;
  return <Montage shots={body.montage} until={until} />;
}

/** One project: its windows in, its name in the taskbar, then all minimize. */
function Chapter({ name, panes, length }: { name: string; panes: Pane[]; length: number }) {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const boxes = mediaLayout(panes.map(p => ratioOf(p.body)), W, H, panes.map(p => TITLE + (p.url ? ADDRESS : 0)));
  const out = length - 8;
  const taskX = portrait ? 150 : 190;
  return (
    <Desktop tasks={frame < out + 7 ? [{ title: name, icon: iconOf(panes[0]), active: true }] : []}>
      {panes.map((pane, i) => {
        const box = boxes[i];
        return (
          <AppWindow
            key={i}
            {...box}
            at={pane.at ?? 0}
            out={out + i}
            taskX={taskX}
            enter={pane.enter ?? "pop"}
            title={pane.title}
            icon={iconOf(pane)}
            active={i === panes.length - 1 || frame < (panes[i + 1]?.at ?? 0)}
            chrome={pane.url ? { address: pane.url } : undefined}
            bodyStyle={{ background: "#0b0b0b" }}
          >
            <Content body={pane.body} until={length} />
          </AppWindow>
        );
      })}
    </Desktop>
  );
}

/* ------------------------------------------------------------------ */
/* Drop 1: the best three                                              */
/* ------------------------------------------------------------------ */

/** Context lives on the wallpaper, with room reserved above the video. */
function StoryCaption({ text, box }: { text: string; box: { x: number; y: number; w: number } }) {
  const { portrait } = useOrientation();
  return <div data-story-caption style={{ position: "absolute", left: box.x + 10, top: box.y - 102,
    width: box.w - 20, height: 88, display: "flex", alignItems: "center", justifyContent: "center",
    textAlign: "center", color: "white", font: `600 ${portrait ? 29 : 28}px/1.25 Tahoma, sans-serif`,
    textShadow: "0 2px 3px #133450, 0 0 14px #133450" }}>{text}</div>;
}

export function Lilyshark() {
  const { W, H } = useOrientation();
  const start = useContext(SceneStart);
  const frame = useCurrentFrame();
  const length = 9 * BAR;
  const box = storyLayout(clipRatio("tdeck-hero"), W, H);
  const shots = [
    { id: "lilyshark-on-camera" as const, at: 0 },
    { id: "tdeck-hero" as const, at: BAR },
    // Voice leads across the 3D shot; enter after the camera reaches the device.
    { id: "lilyshark-max" as const, at: score.dialogue[0].cameraStart - start, from: (score.dialogue[0].cameraStart - score.dialogue[0].start) / 30 },
    { id: "lilyshark-scan" as const, at: 4 * BAR },
    { id: "tdeck-band" as const, at: 5 * BAR },
    { id: "tdeck-bytes" as const, at: 6 * BAR },
    { id: "tdeck-airtime" as const, at: 8 * BAR },
  ];
  const caption = frame < 4 * BAR ? "I built Lilyshark to see what my radio was hearing."
    : frame < 5 * BAR ? "Scan the radio spectrum."
    : frame < 6 * BAR ? "See the whole band."
    : frame < 8 * BAR ? "Inspect the packets behind the signals."
    : "Measure packet airtime.";
  return <Desktop icons={false} tasks={[{ title: "Lilyshark", icon: PLAYER, active: true }]}>
    <StoryCaption text={caption} box={box} />
    <AppWindow {...box} at={0} out={length - 8} title="Lilyshark — packet analyzer" icon={PLAYER}>
      <Montage shots={shots} until={length} />
    </AppWindow>
  </Desktop>;
}

export function Commits() {
  return <Chapter name="commits.sh" length={4 * BAR} panes={[{
    title: "commits.sh — full workspace · timelapse",
    body: { clip: "commits-sh-workspace" },
  }]} />;
}

export function Orbital() {
  const { W, H } = useOrientation();
  const frame = useCurrentFrame();
  const step = Math.min(3, Math.floor(frame / (2 * BAR)));
  const captions = ["Inside the Nancy Grace Roman Space Telescope.", "Follow starlight through the mirrors.",
    "Through the filter, onto the detector array.", "The simulated sky image in my app."];
  const box = storyLayout(step === 3 ? stillRatio("roman-image") : clipRatio("roman-apart"), W, H);
  return <Desktop icons={false} tasks={[{ title: "Orbital Works", icon: PLAYER, active: true }]}>
    <StoryCaption text={captions[step]} box={box} />
    <AppWindow {...box} at={0} out={8 * BAR - 8} title="Orbital Works — Roman telescope" icon={PLAYER}>
      <Sequence durationInFrames={6 * BAR}>
        <Montage shots={[{ id: "roman-apart", at: 0 }, { id: "roman-optics", at: 2 * BAR }, { id: "roman-detectors", at: 4 * BAR }]} until={6 * BAR} />
      </Sequence>
      <Sequence from={6 * BAR} durationInFrames={2 * BAR}><Still id="roman-image" /></Sequence>
    </AppWindow>
  </Desktop>;
}

/* ------------------------------------------------------------------ */
/* Drop 2: a project every six beats                                   */
/* ------------------------------------------------------------------ */

export function AptosMegaeth() {
  return (
    <Chapter
      name="Aptos vs MegaETH"
      length={6 * BEAT}
      panes={[{
        title: "Aptos vs MegaETH - Internet Explorer",
        url: "https://aptos-polymarket.vercel.app/",
        body: { clip: "aptos-vs-megaeth" },
      }]}
    />
  );
}

export function Sol2Move() {
  return (
    <Chapter
      name="Sol2Move"
      length={6 * BEAT}
      panes={[
        {
          title: "Sol2Move — Solidity to Aptos Move",
          body: { clip: "sol2move-first-run" },
          enter: "left",
        },
        {
          title: "Sol2Move — generated Move",
          body: { clip: "sol2move-generated-code" },
          at: 5,
          enter: "right",
        },
      ]}
    />
  );
}

export function Yank() {
  return (
    <Chapter
      name="yank"
      length={6 * BEAT}
      panes={[{
        title: "yank — cloning getone.one - Internet Explorer",
        url: "https://yank.design/",
        body: { clip: "yank-clone" },
        enter: "right",
      }]}
    />
  );
}

export function Nipah() {
  return (
    <Chapter
      name="NipahScan"
      length={6 * BEAT}
      panes={[{
        title: "NipahScan — Nipah virus surveillance",
        body: { clip: "nipahscan" },
      }]}
    />
  );
}

export function Mainnet() {
  return (
    <Chapter
      name="Aptos mainnet"
      length={6 * BEAT}
      panes={[
        {
          title: "Aptos mainnet — Block Machine",
          body: { clip: "aptos-block-machine" },
          enter: "left",
        },
        {
          title: "Aptos mainnet — validators",
          body: { clip: "aptos-validator-globe" },
          at: 5,
          enter: "bottom",
        },
      ]}
    />
  );
}

export function Gadgets() {
  return (
    <Chapter
      name="gadgets.sh"
      length={6 * BEAT}
      panes={[
        {
          title: "gadgets.sh - Internet Explorer",
          url: "https://gadgets.sh/",
          body: { still: "gadgets-catalog" },
          enter: "right",
        },
        {
          title: "gadgets.sh — HuskyLens 2",
          body: { still: "gadgets-huskylens" },
          at: 5,
          enter: "bottom",
        },
      ]}
    />
  );
}
