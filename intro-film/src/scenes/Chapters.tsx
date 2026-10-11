/**
 * The work, best first. Each project is one chapter: its windows open on the
 * downbeat, share the project's name in their titles and taskbar button, and
 * minimize together before the next project opens, so it is always clear
 * which recordings belong together.
 */
import { Sequence, useCurrentFrame } from "remotion";
import { mediaLayout } from "../mediaLayout";
import { BAR, BEAT } from "../beat";
import { AppWindow, asset, Clip, clipRatio, Desktop, Montage, Still, stillRatio, useOrientation, type Enter } from "../xp";
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

export function Lilyshark() {
  const { W, H } = useOrientation();
  const shots = [
    { id: "tdeck-hero" as const, at: 0 },
    { id: "tdeck-bytes" as const, at: 2 * BAR },
    { id: "tdeck-band" as const, at: 4 * BAR },
  ];
  const shorts = ["lilyshark-below-noise", "lilyshark-airtime-short"] as const;
  return (
    <Desktop tasks={[{ title: "Lilyshark", icon: PLAYER, active: true }]}>
      <Sequence durationInFrames={6 * BAR} layout="none">
        <AppWindow {...mediaLayout([clipRatio("tdeck-hero")], W, H)[0]} at={0} out={6 * BAR - 8}
          title="Lilyshark — Wireshark for mesh radio" icon={PLAYER}>
          <Montage shots={shots} until={6 * BAR} />
        </AppWindow>
      </Sequence>
      {shorts.map((id, i) => (
        <Sequence key={id} from={(6 + i * 2) * BAR} durationInFrames={2 * BAR} layout="none">
          <AppWindow {...mediaLayout([clipRatio(id)], W, H)[0]} at={0} out={2 * BAR - 8}
            title={i ? "Lilyshark — why airtime matters" : "Lilyshark — hearing below the noise"} icon={PLAYER}>
            <Clip id={id} />
          </AppWindow>
        </Sequence>
      ))}
    </Desktop>
  );
}

export function Commits() {
  return <Chapter name="commits.sh" length={4 * BAR} panes={[{
    title: "commits.sh — full workspace · timelapse",
    body: { clip: "commits-sh-workspace" },
  }]} />;
}

/** One connected chapter: land acknowledgment, the atlas, then language. */
export function LandLanguage() {
  const { portrait } = useOrientation();
  const views = [
    { title: "Tend — land acknowledgment", still: "tend-home" as const },
    { title: "Presidio Atlas — land & history", still: portrait ? "presidio-portrait" as const : "presidio-landscape" as const },
    { title: "Ohlone Unicode — language", still: portrait ? "ohlone-portrait" as const : "ohlone-landscape" as const },
  ];
  return <>{views.map((view, i) => (
    <Sequence key={view.title} from={i * 2 * BAR} durationInFrames={2 * BAR} layout="none">
      <Chapter name="Land & language" length={2 * BAR} panes={[{ title: view.title, body: { still: view.still } }]} />
    </Sequence>
  ))}</>;
}

export function Orbital() {
  return (
    <Chapter
      name="Orbital Works"
      length={3 * BAR}
      panes={[
        {
          title: "Orbital Works — Nancy Grace Roman Space Telescope",
          body: { montage: [{ id: "roman-earth", at: 0 }, { id: "roman-apart", at: BAR }, { id: "roman-wheel", at: 2 * BAR }] },
        },
        {
          title: "Orbital Works - Internet Explorer",
          url: "https://orbital-works.vercel.app/",
          body: { clip: "orbital-site" },
          at: 0,
          enter: "right",
        },
      ]}
    />
  );
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
