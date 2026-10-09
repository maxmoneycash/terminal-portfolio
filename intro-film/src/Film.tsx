import { Series } from "remotion";
import { SceneStart } from "./xp";
import { Aptos } from "./scenes/Aptos";
import { Arrival } from "./scenes/Arrival";
import { Boot } from "./scenes/Boot";
import { Cascade } from "./scenes/Cascade";
import { DevEnv } from "./scenes/DevEnv";
import { Finale } from "./scenes/Finale";
import { FLOOD_FRAMES, Flood } from "./scenes/Flood";
import { Gadgets } from "./scenes/Gadgets";
import { Lilyshark } from "./scenes/Lilyshark";
import { Login } from "./scenes/Login";
import { Mainnet } from "./scenes/Mainnet";
import { Nipah } from "./scenes/Nipah";
import { Notepad } from "./scenes/Notepad";
import { PICTURES_FRAMES, Pictures } from "./scenes/Pictures";
import { ROMAN_FRAMES, Roman } from "./scenes/Roman";
import { Sol2Move } from "./scenes/Sol2Move";
import { TaskManager } from "./scenes/TaskManager";
import { TIMELAPSE_FRAMES, Timelapse } from "./scenes/Timelapse";
import { Yank } from "./scenes/Yank";

/** Scene order and lengths (frames at 30 fps). */
export const SCENES = [
  { name: "boot", frames: 60, component: Boot },
  { name: "login", frames: 112, component: Login },
  { name: "timelapse", frames: TIMELAPSE_FRAMES, component: Timelapse },
  { name: "arrival", frames: 90, component: Arrival },
  { name: "lilyshark", frames: 110, component: Lilyshark },
  { name: "gadgets", frames: 105, component: Gadgets },
  { name: "notepad", frames: 100, component: Notepad },
  { name: "devenv", frames: 120, component: DevEnv },
  { name: "yank", frames: 118, component: Yank },
  { name: "aptos", frames: 120, component: Aptos },
  { name: "sol2move", frames: 124, component: Sol2Move },
  { name: "mainnet", frames: 90, component: Mainnet },
  { name: "nipah", frames: 90, component: Nipah },
  { name: "roman", frames: ROMAN_FRAMES, component: Roman },
  { name: "pictures", frames: PICTURES_FRAMES, component: Pictures },
  { name: "cascade", frames: 108, component: Cascade },
  { name: "taskmanager", frames: 100, component: TaskManager },
  { name: "flood", frames: FLOOD_FRAMES, component: Flood },
  { name: "finale", frames: 54, component: Finale },
] as const;

export const FILM_FRAMES = SCENES.reduce((sum, scene) => sum + scene.frames, 0);

/** First frame of each scene, for review renders. */
export const SCENE_STARTS = SCENES.reduce<Record<string, number>>((starts, scene, i) => {
  starts[scene.name] = i === 0 ? 0 : starts[SCENES[i - 1].name] + SCENES[i - 1].frames;
  return starts;
}, {});

export function Film() {
  return (
    <Series>
      {SCENES.map(({ name, frames, component: Scene }) => (
        <Series.Sequence key={name} durationInFrames={frames} name={name}>
          <SceneStart.Provider value={SCENE_STARTS[name]}>
            <Scene />
          </SceneStart.Provider>
        </Series.Sequence>
      ))}
    </Series>
  );
}
