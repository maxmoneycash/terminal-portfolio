import { AbsoluteFill, Audio, Series, staticFile, useCurrentFrame } from "remotion";
import { BEAT, dropFlash } from "./beat";
import { SceneStart } from "./xp";
import { AptosMegaeth, Commits, LandLanguage, Gadgets, Lilyshark, Mainnet, Nipah, Orbital, Sol2Move, Yank } from "./scenes/Chapters";
import { Overload } from "./scenes/Overload";
import { Radio } from "./scenes/Radio";
import { Sign } from "./scenes/Sign";
import chapters from "../../src/intro/chapters.json";

/**
 * Scene order and lengths in beats (14 frames each). Sections follow the
 * soundtrack in score.json: the signature 4 bars, the radio 2, then three
 * drops (26, 9, 7) that get faster and denser. Every cut lands on a beat.
 */
const components = { sign: Sign, radio: Radio, lilyshark: Lilyshark, commits: Commits, orbital: Orbital,
  "land-language": LandLanguage, aptos: AptosMegaeth, sol2move: Sol2Move, yank: Yank, nipah: Nipah,
  mainnet: Mainnet, gadgets: Gadgets, overload: Overload };
// The same beat map drives the rendered scenes and the site's chapter controls.
export const SCENES = chapters.map(({ id, beats }) => ({ name: id, beats, component: components[id as keyof typeof components] }));

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
