import { AbsoluteFill, Audio, Series, staticFile, useCurrentFrame } from "remotion";
import { BEAT, dropFlash } from "./beat";
import { SceneStart } from "./xp";
import { AptosMegaeth, Commits, LandLanguage, Gadgets, Lilyshark, Mainnet, Nipah, Orbital, Sol2Move, Yank } from "./scenes/Chapters";
import { Overload } from "./scenes/Overload";
import { Radio } from "./scenes/Radio";
import { Sign } from "./scenes/Sign";

/**
 * Scene order and lengths in beats (14 frames each). Sections follow the
 * soundtrack in score.json: the signature 4 bars, the radio 2, then three
 * drops (23, 9, 7) that get faster and denser. Every cut lands on a beat.
 */
export const SCENES = [
  // the signature, then the radio's callsign
  { name: "sign", beats: 16, component: Sign },
  { name: "radio", beats: 8, component: Radio },
  // drop 1: the best work
  { name: "lilyshark", beats: 40, component: Lilyshark },
  { name: "commits", beats: 16, component: Commits },
  { name: "orbital", beats: 12, component: Orbital },
  { name: "land-language", beats: 24, component: LandLanguage },
  // drop 2: a project every six beats
  { name: "aptos", beats: 6, component: AptosMegaeth },
  { name: "sol2move", beats: 6, component: Sol2Move },
  { name: "yank", beats: 6, component: Yank },
  { name: "nipah", beats: 6, component: Nipah },
  { name: "mainnet", beats: 6, component: Mainnet },
  { name: "gadgets", beats: 6, component: Gadgets },
  // drop 3: overload, then "your turn."
  { name: "overload", beats: 28, component: Overload },
] as const;

export const FILM_FRAMES = SCENES.reduce((sum, scene) => sum + scene.beats * BEAT, 0);

/** First frame of each scene, for review renders. */
export const SCENE_STARTS = SCENES.reduce<Record<string, number>>((starts, scene, i) => {
  starts[scene.name] = i === 0 ? 0 : starts[SCENES[i - 1].name] + SCENES[i - 1].beats * BEAT;
  return starts;
}, {});

export function Film() {
  const frame = useCurrentFrame();
  const flash = dropFlash(frame);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill>
        <Series>
          {SCENES.map(({ name, beats, component: Scene }) => (
            <Series.Sequence key={name} durationInFrames={beats * BEAT} name={name}>
              <SceneStart.Provider value={SCENE_STARTS[name]}>
                <Scene />
              </SceneStart.Provider>
            </Series.Sequence>
          ))}
        </Series>
      </AbsoluteFill>
      {flash > 0.01 ? <AbsoluteFill style={{ background: "#fff", opacity: 0.55 * flash, pointerEvents: "none" }} /> : null}
      <Audio src={staticFile("music/soundtrack.wav")} volume={0.9} />
    </AbsoluteFill>
  );
}
