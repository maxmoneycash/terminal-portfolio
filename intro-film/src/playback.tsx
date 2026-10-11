import { createContext, useContext } from "react";

/** Browser assets are streamed as individual shots; offline renders use masters. */
export type PlaybackMedia = {
  clips: Record<string, { src: string; mobile: string; poster: string }>;
  stills: Record<string, string>;
  soundtrack: string;
  wallpaperFrames: number;
  mobile: boolean;
};
export const WebPlayback = createContext<PlaybackMedia | null>(null);
export const useWebPlayback = () => useContext(WebPlayback);
