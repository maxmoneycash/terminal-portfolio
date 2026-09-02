/**
 * Windows Picture and Fax Viewer — a dedicated gallery over the real deploy
 * shots in My Pictures. Best-fit / actual size, rotate, filmstrip, and a
 * slideshow. No mock images.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { galleryPictures, sizeLabel, type ImageFile } from "../data/files";
import { MenuBar, type WindowMenu } from "./MenuBar";

const SLIDESHOW_INTERVAL_MS = 4000;

type FitMode = "best" | "actual";

type NaturalSize = { width: number; height: number };

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wrapIndex(index: number, count: number) {
  return ((index % count) + count) % count;
}

function ToolbarGlyph({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

function PicturesToolbarButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn("pictures-tool", pressed && "is-pressed")}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function PicturesApp() {
  const pictures = galleryPictures;
  const count = pictures.length;
  const [index, setIndex] = useState(0);
  const [fit, setFit] = useState<FitMode>("best");
  const [turns, setTurns] = useState(0);
  const [slideshow, setSlideshow] = useState(false);
  const [failed, setFailed] = useState(false);
  const [natural, setNatural] = useState<NaturalSize>({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState<NaturalSize>({ width: 0, height: 0 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const filmstripRef = useRef<HTMLDivElement | null>(null);

  const current: ImageFile | undefined = pictures[index];
  const rotation = ((turns % 4) + 4) % 4;
  const degrees = rotation * 90;
  const quarterTurn = rotation % 2 === 1;

  const show = useCallback(
    (nextIndex: number) => {
      setIndex(wrapIndex(nextIndex, count));
      setTurns(0);
      setFailed(false);
      setNatural({ width: 0, height: 0 });
    },
    [count],
  );

  const step = useCallback((delta: number) => show(index + delta), [index, show]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const selected = filmstripRef.current?.querySelector<HTMLElement>("[aria-current='true']");
    selected?.scrollIntoView({ inline: "center", block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [index]);

  useEffect(() => {
    if (!slideshow || count < 2) return;
    if (prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      setIndex((currentIndex) => wrapIndex(currentIndex + 1, count));
      setTurns(0);
      setFailed(false);
      setNatural({ width: 0, height: 0 });
    }, SLIDESHOW_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [slideshow, count]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const win = root.closest(".xp-window");
      if (!win?.classList.contains("is-active")) return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea")) return;

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          step(-1);
          break;
        case "ArrowRight":
          event.preventDefault();
          step(1);
          break;
        case "Home":
          event.preventDefault();
          show(0);
          break;
        case "End":
          event.preventDefault();
          show(count - 1);
          break;
        case " ":
        case "F11":
          event.preventDefault();
          setSlideshow((value) => !value);
          break;
        case "Escape":
          if (slideshow) {
            event.preventDefault();
            setSlideshow(false);
          }
          break;
        case "r":
        case "R":
          event.preventDefault();
          setTurns((value) => value + 1);
          break;
        case "l":
        case "L":
          event.preventDefault();
          setTurns((value) => value - 1);
          break;
        case "0":
        case "b":
        case "B":
          event.preventDefault();
          setFit("best");
          break;
        case "1":
          event.preventDefault();
          setFit("actual");
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [count, show, slideshow, step]);

  const closeWindow = () => {
    window.dispatchEvent(new CustomEvent("maxxp:close-window", { detail: { id: "pictures" } }));
  };

  const framed = useMemo(() => {
    const drawWidth = quarterTurn ? natural.height : natural.width;
    const drawHeight = quarterTurn ? natural.width : natural.height;
    if (drawWidth <= 0 || drawHeight <= 0 || stageSize.width <= 0 || stageSize.height <= 0) {
      return { width: 0, height: 0, scale: 0 };
    }
    const scale =
      fit === "best" ? Math.min(stageSize.width / drawWidth, stageSize.height / drawHeight, 1) : 1;
    return { width: drawWidth * scale, height: drawHeight * scale, scale };
  }, [fit, natural.height, natural.width, quarterTurn, stageSize.height, stageSize.width]);

  const menus: WindowMenu[] = [
    {
      label: "File",
      items: [
        { label: "Previous Picture", onSelect: () => step(-1), disabled: count < 2 },
        { label: "Next Picture", onSelect: () => step(1), disabled: count < 2 },
        "separator",
        { label: "Close", onSelect: closeWindow },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Best Fit", checked: fit === "best", onSelect: () => setFit("best") },
        { label: "Actual Size", checked: fit === "actual", onSelect: () => setFit("actual") },
        "separator",
        { label: "Rotate Clockwise", onSelect: () => setTurns((value) => value + 1) },
        { label: "Rotate Counterclockwise", onSelect: () => setTurns((value) => value - 1) },
        "separator",
        {
          label: slideshow ? "Stop Slideshow" : "Start Slideshow",
          checked: slideshow,
          onSelect: () => setSlideshow((value) => !value),
          disabled: count < 2,
        },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Left / Right: previous or next", disabled: true },
        { label: "Space / F11: slideshow", disabled: true },
        { label: "R / L: rotate", disabled: true },
      ],
    },
  ];

  if (!current) return null;

  return (
    <div
      ref={rootRef}
      className={cn("pictures-app", slideshow && "is-slideshow")}
      tabIndex={-1}
    >
      <MenuBar menus={menus} ariaLabel="Picture and Fax Viewer menu" />

      <div
        ref={stageRef}
        className={cn("pictures-stage", fit === "actual" && "is-actual")}
      >
        {failed ? (
          <div className="pictures-missing" role="status">
            <strong>This file cannot be displayed.</strong>
            <span>{current.name}</span>
            <span>{current.caption}</span>
          </div>
        ) : (
          <div
            className="pictures-frame"
            style={
              framed.width > 0
                ? { width: framed.width, height: framed.height }
                : undefined
            }
          >
            <img
              src={current.src}
              alt={current.caption}
              draggable={false}
              style={{
                width: natural.width > 0 ? natural.width * (framed.scale || 1) : undefined,
                height: natural.height > 0 ? natural.height * (framed.scale || 1) : undefined,
                transform: `rotate(${degrees}deg)`,
              }}
              onLoad={(event) => {
                setFailed(false);
                setNatural({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }}
              onError={() => setFailed(true)}
            />
          </div>
        )}
      </div>

      <div className="pictures-toolbar" role="toolbar" aria-label="Picture tools">
        <PicturesToolbarButton label="Previous Picture" disabled={count < 2} onClick={() => step(-1)}>
          <ToolbarGlyph path="M10.2 2.4 4.6 8l5.6 5.6 1.2-1.2L7 8l4.4-4.4z" />
        </PicturesToolbarButton>
        <PicturesToolbarButton label="Next Picture" disabled={count < 2} onClick={() => step(1)}>
          <ToolbarGlyph path="M5.8 2.4 11.4 8 5.8 13.6 4.6 12.4 9 8 4.6 3.6z" />
        </PicturesToolbarButton>
        <span className="pictures-tool-sep" aria-hidden="true" />
        <PicturesToolbarButton
          label="Best Fit"
          pressed={fit === "best"}
          onClick={() => setFit("best")}
        >
          <ToolbarGlyph path="M2 2h5v1.6H3.6V7H2V2zm7 0h5v5h-1.6V3.6H9V2zM2 9h1.6v3.4H7V14H2V9zm10.4 3.4V9H14v5H9v-1.6h3.4z" />
        </PicturesToolbarButton>
        <PicturesToolbarButton
          label="Actual Size"
          pressed={fit === "actual"}
          onClick={() => setFit("actual")}
        >
          <ToolbarGlyph path="M3 3h4v1.5H4.5V7H3V3zm6 0h4v4h-1.5V4.5H9V3zM3 9h1.5v2.5H7V13H3V9zm8.5 2.5V9H13v4H9v-1.5h2.5zM6.2 6.2h3.6v3.6H6.2z" />
        </PicturesToolbarButton>
        <PicturesToolbarButton
          label={slideshow ? "Stop Slideshow" : "Start Slideshow"}
          pressed={slideshow}
          disabled={count < 2}
          onClick={() => setSlideshow((value) => !value)}
        >
          {slideshow ? (
            <ToolbarGlyph path="M4 3.5h2.6v9H4zm5.4 0H12v9H9.4z" />
          ) : (
            <ToolbarGlyph path="M5 3.2 12.4 8 5 12.8z" />
          )}
        </PicturesToolbarButton>
        <span className="pictures-tool-sep" aria-hidden="true" />
        <PicturesToolbarButton label="Rotate Clockwise" onClick={() => setTurns((value) => value + 1)}>
          <ToolbarGlyph path="M8 2a6 6 0 1 1-5.3 3.2l1.4.6A4.4 4.4 0 1 0 8 3.6V6l3.2-2.4L8 1.2V2z" />
        </PicturesToolbarButton>
        <PicturesToolbarButton
          label="Rotate Counterclockwise"
          onClick={() => setTurns((value) => value - 1)}
        >
          <ToolbarGlyph path="M8 2v-.8L4.8 3.6 8 6V3.6A4.4 4.4 0 1 1 3.7 5.8l-1.4-.6A6 6 0 1 0 8 2z" />
        </PicturesToolbarButton>
        <span className="pictures-caption" title={current.caption}>
          {index + 1} of {count} · {current.name} · {sizeLabel(current.sizeBytes)}
        </span>
      </div>

      <div className="pictures-filmstrip" ref={filmstripRef} role="listbox" aria-label="Pictures">
        {pictures.map((picture, pictureIndex) => (
          <button
            key={picture.name}
            type="button"
            role="option"
            aria-selected={pictureIndex === index}
            aria-current={pictureIndex === index}
            className={cn("pictures-thumb", pictureIndex === index && "is-current")}
            title={picture.caption}
            onClick={() => {
              show(pictureIndex);
              setSlideshow(false);
            }}
          >
            <img src={picture.src} alt="" draggable={false} />
            <span>{picture.name.replace(/\.jpg$/, "")}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
