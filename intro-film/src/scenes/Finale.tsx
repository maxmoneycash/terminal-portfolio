import { AbsoluteFill, useCurrentFrame } from "remotion";
import { progress } from "../lib";
import { Desktop, useOrientation } from "../xp";
import { WelcomeWords } from "./Login";

/** Clean desktop and the handoff line; the live desktop takes over after. */
export function Finale() {
  const frame = useCurrentFrame();
  const { portrait } = useOrientation();
  const fade = 1 - progress(frame, 38, 14);
  return (
    <Desktop>
      <AbsoluteFill style={{ display: "grid", placeItems: "center", opacity: fade }}>
        <WelcomeWords words={["your", "turn."]} at={4} every={8} size={portrait ? 60 : 84} align="center" />
      </AbsoluteFill>
    </Desktop>
  );
}
