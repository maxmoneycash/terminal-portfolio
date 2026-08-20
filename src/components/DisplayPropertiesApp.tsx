/**
 * Display Properties — the XP dialog, wired to real shell state: wallpaper
 * (Bliss animated / still / none), the Mystify screensaver with wait time and
 * live preview, and CRT effects under Appearance. Changes apply immediately;
 * OK closes the window.
 */
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { getCrtEnabled, setCrtEnabled, subscribeCrt } from "../xp/crtStore";
import {
  getWallpaperMotion,
  getWallpaperPaper,
  setWallpaperMotion,
  setWallpaperPaper,
  subscribeWallpaperMotion,
  subscribeWallpaperPaper,
  type WallpaperMotion,
  type WallpaperPaper,
} from "../xp/Wallpaper";
import {
  MystifyCanvas,
  getSaverSettings,
  previewScreenSaver,
  setSaverSettings,
  subscribeSaver,
  type SaverSettings,
} from "./ScreenSaver";

type Tab = "desktop" | "screensaver" | "appearance";

type PaperChoice = "bliss-animated" | "bliss-still" | "none";

function currentPaperChoice(paper: WallpaperPaper, motion: WallpaperMotion): PaperChoice {
  if (paper === "none") return "none";
  return motion === "off" ? "bliss-still" : "bliss-animated";
}

const PAPER_OPTIONS: { id: PaperChoice; label: string }[] = [
  { id: "bliss-animated", label: "Bliss (animated)" },
  { id: "bliss-still", label: "Bliss" },
  { id: "none", label: "(None)" },
];

export function DisplayPropertiesApp() {
  const [tab, setTab] = useState<Tab>("desktop");
  const [paper, setPaper] = useState<WallpaperPaper>(getWallpaperPaper);
  const [motion, setMotion] = useState<WallpaperMotion>(getWallpaperMotion);
  const [saver, setSaver] = useState<SaverSettings>(getSaverSettings);
  const [crt, setCrt] = useState<boolean>(getCrtEnabled);

  useEffect(() => subscribeWallpaperPaper(setPaper), []);
  useEffect(() => subscribeWallpaperMotion(setMotion), []);
  useEffect(() => subscribeSaver(setSaver), []);
  useEffect(() => subscribeCrt(setCrt), []);

  const choice = currentPaperChoice(paper, motion);

  const applyPaper = (next: PaperChoice) => {
    if (next === "none") {
      setWallpaperPaper("none");
      return;
    }
    setWallpaperPaper("bliss");
    setWallpaperMotion(next === "bliss-animated" ? "on" : "off");
  };

  const close = () => {
    window.dispatchEvent(new CustomEvent("maxxp:close-window", { detail: { id: "display" } }));
  };

  return (
    <div className="display-app">
      <div className="display-tabs" role="tablist" aria-label="Display Properties tabs">
        {(
          [
            ["desktop", "Desktop"],
            ["screensaver", "Screen Saver"],
            ["appearance", "Appearance"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={cn("display-tab", tab === id && "is-active")}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="display-panel" role="tabpanel">
        <div className="display-monitor" aria-hidden="true">
          <div className="display-monitor-screen">
            {tab === "screensaver" && saver.saver === "mystify" ? (
              <MystifyCanvas className="display-monitor-canvas" />
            ) : choice === "none" ? (
              <div className="display-monitor-solid" />
            ) : (
              <img src="/xp/gui/bgs/bliss-desktop.webp" alt="" />
            )}
          </div>
          <div className="display-monitor-stand" />
        </div>

        {tab === "desktop" ? (
          <fieldset className="xp-group-box display-fieldset">
            <legend>Background</legend>
            <div className="display-paper-list" role="radiogroup" aria-label="Wallpaper">
              {PAPER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={choice === option.id}
                  className={cn("display-paper-item", choice === option.id && "is-selected")}
                  onClick={() => applyPaper(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="display-note">
              Bliss plays as an orientation-aware video loop; "(None)" is the stock Luna teal.
            </p>
          </fieldset>
        ) : null}

        {tab === "screensaver" ? (
          <fieldset className="xp-group-box display-fieldset">
            <legend>Screen saver</legend>
            <div className="display-saver-row">
              <select
                value={saver.saver}
                onChange={(event) => setSaverSettings({ saver: event.target.value as SaverSettings["saver"] })}
                aria-label="Screen saver"
              >
                <option value="mystify">Mystify</option>
                <option value="none">(None)</option>
              </select>
              <button className="xp-control" type="button" onClick={previewScreenSaver} disabled={saver.saver === "none"}>
                Preview
              </button>
            </div>
            <label className="display-saver-wait">
              Wait:
              <input
                type="number"
                min={1}
                max={60}
                value={saver.waitMinutes}
                onChange={(event) =>
                  setSaverSettings({ waitMinutes: Math.max(1, Math.min(60, Number(event.target.value) || 1)) })
                }
              />
              minutes
            </label>
            <p className="display-note">
              Wakes on any input. Never starts automatically for visitors who prefer reduced motion.
            </p>
          </fieldset>
        ) : null}

        {tab === "appearance" ? (
          <fieldset className="xp-group-box display-fieldset">
            <legend>Appearance</legend>
            <label className="display-check">
              <input
                type="checkbox"
                checked={crt}
                onChange={(event) => setCrtEnabled(event.target.checked)}
              />
              CRT effects (scanlines and glow)
            </label>
            <label className="display-locked">
              Windows and buttons:
              <select disabled>
                <option>Windows XP style</option>
              </select>
            </label>
            <label className="display-locked">
              Color scheme:
              <select disabled>
                <option>Default (blue)</option>
              </select>
            </label>
            <p className="display-note">The Luna look is committed brand — polish within it, never away from it.</p>
          </fieldset>
        ) : null}
      </div>

      <div className="display-footer">
        <button className="xp-control primary" type="button" onClick={close}>
          OK
        </button>
      </div>
    </div>
  );
}
