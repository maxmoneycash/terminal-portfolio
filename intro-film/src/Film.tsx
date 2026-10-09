import { AbsoluteFill, Audio, Series, staticFile, useCurrentFrame } from "remotion";
import { BEAT, dropFlash, kick } from "./beat";
import { SceneStart } from "./xp";
import { Aptos } from "./scenes/Aptos";
import { Boot } from "./scenes/Boot";
import { Cascade } from "./scenes/Cascade";
import { DevEnv } from "./scenes/DevEnv";
import { Finale } from "./scenes/Finale";
import { Flood } from "./scenes/Flood";
import { Gadgets } from "./scenes/Gadgets";
import { Lilyshark } from "./scenes/Lilyshark";
import { Login } from "./scenes/Login";
import { Mainnet } from "./scenes/Mainnet";
import { Nipah } from "./scenes/Nipah";
import { Notepad } from "./scenes/Notepad";
import { Pictures } from "./scenes/Pictures";
import { Roman } from "./scenes/Roman";
import { Sol2Move } from "./scenes/Sol2Move";
import { Station } from "./scenes/Station";
import { TaskManager } from "./scenes/TaskManager";
import { Timelapse } from "./scenes/Timelapse";
import { Yank } from "./scenes/Yank";

/**
 * Scene order and lengths in beats (14 frames each). Sections follow the
 * soundtrack in score.json: intro 4 bars, drop 8, breakdown 4, drop 8,
 * space 4, drop 8. Every cut lands on a beat, most on a bar line.
 */
export const SCENES = [
  // intro
  { name: "boot", beats: 6, component: Boot },
  { name: "login", beats: 10, component: Login },
  // drop 1: the radio and the quill, then the hardware and the code
  { name: "station", beats: 12, component: Station },
  { name: "lilyshark", beats: 8, component: Lilyshark },
  { name: "gadgets", beats: 4, component: Gadgets },
  { name: "timelapse", beats: 8, component: Timelapse },
  // breakdown
  { name: "notepad", beats: 8, component: Notepad },
  { name: "devenv", beats: 8, component: DevEnv },
  // drop 2
  { name: "yank", beats: 8, component: Yank },
  { name: "aptos", beats: 8, component: Aptos },
  { name: "sol2move", beats: 8, component: Sol2Move },
  { name: "mainnet", beats: 4, component: Mainnet },
  { name: "nipah", beats: 4, component: Nipah },
  // space
  { name: "roman", beats: 16, component: Roman },
  // drop 3
  { name: "pictures", beats: 8, component: Pictures },
  { name: "cascade", beats: 8, component: Cascade },
  { name: "taskmanager", beats: 4, component: TaskManager },
  { name: "flood", beats: 8, component: Flood },
  { name: "finale", beats: 4, component: Finale },
] as const;

export const FILM_FRAMES = SCENES.reduce((sum, scene) => sum + scene.beats * BEAT, 0);

/** First frame of each scene, for review renders. */
export const SCENE_STARTS = SCENES.reduce<Record<string, number>>((starts, scene, i) => {
  starts[scene.name] = i === 0 ? 0 : starts[SCENES[i - 1].name] + SCENES[i - 1].beats * BEAT;
  return starts;
}, {});

export function Film() {
  const frame = useCurrentFrame();
  // Every kick in the drops pushes the frame in a touch; downbeats more.
  const punch = 1 + 0.016 * kick(frame);
  const flash = dropFlash(frame);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${punch})`, transformOrigin: "50% 50%" }}>
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
