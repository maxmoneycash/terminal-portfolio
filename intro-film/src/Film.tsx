import { AbsoluteFill, Audio, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BEAT, dropFlash } from "./beat";
import { SceneStart } from "./xp";
import { AptosMegaeth, Commits, Gadgets, Lilyshark, Mainnet, Nipah, Orbital, Sol2Move, Yank } from "./scenes/Chapters";
import { Overload } from "./scenes/Overload";
import { Radio } from "./scenes/Radio";
import { Sign } from "./scenes/Sign";
import chapters from "../../src/intro/chapters.json";
import { useWebPlayback } from "./playback";

/**
 * Scene order and lengths in beats (14 frames each). Sections follow the
 * soundtrack in score.json: the signature 2 bars, the radio 2, then three
 * drops (21, 9, 6) that get faster and denser. Every cut lands on a beat.
 */
const components = { sign: Sign, radio: Radio, lilyshark: Lilyshark, commits: Commits, orbital: Orbital,
  aptos: AptosMegaeth, sol2move: Sol2Move, yank: Yank, nipah: Nipah,
  mainnet: Mainnet, gadgets: Gadgets, overload: Overload };
// One beat map drives browser playback and offline renders.
export const SCENES = chapters.map(({ id, beats }) => ({ name: id, beats, component: components[id as keyof typeof components] }));

export const FILM_FRAMES = SCENES.reduce((sum, scene) => sum + scene.beats * BEAT, 0);

/** First frame of each scene, for review renders. */
export const SCENE_STARTS = SCENES.reduce<Record<string, number>>((starts, scene, i) => {
  starts[scene.name] = i === 0 ? 0 : starts[SCENES[i - 1].name] + SCENES[i - 1].beats * BEAT;
  return starts;
}, {});

export function Film() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const web = useWebPlayback();
  const flash = dropFlash(frame);
  return (
    <AbsoluteFill style={{ background: "#3a6ea5" }}>
      {web && <AbsoluteFill style={{ background: `url(/xp/gui/bgs/bliss-${height > width ? "mobile" : "desktop"}.webp) center / cover` }}>
        <Loop durationInFrames={web.wallpaperFrames}>
          <OffthreadVideo src={`/xp/video/bliss-loop-${height > width ? "portrait" : "landscape"}.mp4`} muted
            pauseWhenBuffering={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Loop>
      </AbsoluteFill>}
      <AbsoluteFill>
        {SCENES.map(({ name, beats, component: Scene }) => (
          <Sequence key={name} from={SCENE_STARTS[name]} durationInFrames={beats * BEAT} name={name} premountFor={web ? 30 : 0}>
            <SceneStart.Provider value={SCENE_STARTS[name]}>
              <Scene />
            </SceneStart.Provider>
          </Sequence>
        ))}
      </AbsoluteFill>
      {flash > 0.01 ? <AbsoluteFill style={{ background: "#fff", opacity: 0.55 * flash, pointerEvents: "none" }} /> : null}
      {/* Music and dialogue are mixed together on the beat grid in music.py. */}
      <Audio src={web ? web.soundtrack : staticFile("music/soundtrack.wav")} volume={0.9} pauseWhenBuffering />
    </AbsoluteFill>
  );
}
