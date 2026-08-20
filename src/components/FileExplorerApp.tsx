/**
 * My Documents — an XP Explorer view over the portfolio's virtual filesystem
 * (src/data/files.ts). Folders pane on the left, icon grid on the right, and
 * a single click opens files in draggable, resizable child windows, cascade-
 * offset like the real thing.
 *
 * Files have real types with real viewers: .txt opens in Notepad (working
 * menus, Word Wrap, live Ln/Col), .jpg in a Picture-and-Fax-Viewer with
 * prev/next, .mp4 in a media player, .pdf in a reader, and .url shortcuts
 * open the live site in a new tab. Image and video grid icons are actual
 * thumbnails.
 */
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "../lib/cn";
import { playSfx } from "../xp/audio";
import { MenuBar, type WindowMenu } from "./MenuBar";
import {
  MY_DOCUMENTS_PATH,
  folderSizeLabel,
  myDocuments,
  nodeSizeBytes,
  resolveFolder,
  sizeLabel,
  type ExplorerFile,
  type ExplorerNode,
  type ImageFile,
} from "../data/files";

const CASCADE_STEP = 26;
const VIEWER_MIN_WIDTH = 260;
const VIEWER_MIN_HEIGHT = 180;

const VIEWER_DEFAULT_SIZE: Record<Exclude<ExplorerFile["type"], "url">, { width: number; height: number }> = {
  txt: { width: 430, height: 330 },
  image: { width: 560, height: 440 },
  video: { width: 560, height: 420 },
  pdf: { width: 580, height: 540 },
};

const VIEWER_TITLE_SUFFIX: Record<Exclude<ExplorerFile["type"], "url">, string> = {
  txt: "Notepad",
  image: "Windows Picture and Fax Viewer",
  video: "Windows Media Player",
  pdf: "PDF Reader",
};

type ViewerWindow = {
  id: number;
  file: Exclude<ExplorerFile, { type: "url" }>;
  /** Sibling images at open time, for prev/next in the picture viewer. */
  gallery: ImageFile[];
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  maximized: boolean;
};

type ViewerDrag =
  | { mode: "move"; id: number; startX: number; startY: number; originX: number; originY: number }
  | { mode: "resize"; id: number; startX: number; startY: number; width: number; height: number };

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function infotip(node: ExplorerNode): string {
  if (node.kind === "folder") {
    return `File Folder\nContains: ${node.children.length} objects\nSize: ${sizeLabel(nodeSizeBytes(node))}`;
  }
  switch (node.type) {
    case "txt":
      return `Text Document\nSize: ${sizeLabel(node.content.length)}\nLines: ${node.content.split("\n").length}`;
    case "url":
      return `Internet Shortcut\nOpens: ${node.href}`;
    case "image":
      return `JPEG Image\n${node.caption}\nSize: ${sizeLabel(node.sizeBytes)}`;
    case "video":
      return `Video Clip\n${node.caption}\nSize: ${sizeLabel(node.sizeBytes)}`;
    case "pdf":
      return `PDF Document\nSize: ${sizeLabel(node.sizeBytes)}`;
  }
}

/* ------------------------------------------------------------------ */
/* Glyphs                                                              */
/* ------------------------------------------------------------------ */

function FolderGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <defs>
        <linearGradient id="xp-folder-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE9A2" />
          <stop offset="0.55" stopColor="#FCD462" />
          <stop offset="1" stopColor="#F0B429" />
        </linearGradient>
      </defs>
      <path
        d="M1 5.5c0-.8.7-1.5 1.5-1.5H8l1.6 2H17.5c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-15C1.7 18 1 17.3 1 16.5v-11z"
        fill="url(#xp-folder-face)"
        stroke="#B8860B"
        strokeWidth=".5"
      />
      <path d="M1.6 8.2h16.8" stroke="#fff" strokeWidth=".7" opacity=".6" />
    </svg>
  );
}

function TextFileGlyph() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M14 2h26l10 10v46a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z"
        fill="#fff"
        stroke="#8C8C8C"
        strokeWidth="1.2"
      />
      <path d="M40 2v10h10z" fill="#D8D8D8" />
      {[22, 28, 34, 40, 46].map((y) => (
        <rect key={y} x="18" y={y} width={y === 46 ? 16 : 28} height="2.6" rx="1.3" fill="#7C90AC" />
      ))}
    </svg>
  );
}

function PdfGlyph() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M14 2h26l10 10v46a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z"
        fill="#fff"
        stroke="#8C8C8C"
        strokeWidth="1.2"
      />
      <path d="M40 2v10h10z" fill="#D8D8D8" />
      <rect x="15" y="26" width="34" height="20" rx="3" fill="#C11E1E" />
      <text
        x="32"
        y="41"
        fontSize="13"
        fontFamily="Arial"
        fontWeight="bold"
        fill="#fff"
        textAnchor="middle"
      >
        PDF
      </text>
    </svg>
  );
}

function GlobeGlyph() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="#3f8fe0" stroke="#1a5fb0" strokeWidth="2" />
      <ellipse cx="32" cy="32" rx="12" ry="26" fill="none" stroke="#cfe8ff" strokeWidth="2" />
      <ellipse cx="32" cy="32" rx="26" ry="11" fill="none" stroke="#cfe8ff" strokeWidth="2" />
      <path d="M8 22h48M8 42h48" stroke="#cfe8ff" strokeWidth="2" fill="none" />
      <path d="M20 14c6 7 6 29 0 36M44 14c-6 7-6 29 0 36" stroke="#9fd0ff" strokeWidth="1.4" fill="none" />
    </svg>
  );
}

function ComputerGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="1" y="3" width="18" height="11" rx="1" fill="#C9D6E8" stroke="#5C7EAE" strokeWidth=".6" />
      <rect x="3" y="5" width="14" height="7" fill="#3E6BC4" />
      <rect x="6" y="15" width="8" height="2" fill="#8C99A8" />
    </svg>
  );
}

function DriveGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="1" y="6" width="18" height="8" rx="1" fill="#C9D6E8" stroke="#5C7EAE" strokeWidth=".6" />
      <circle cx="15.5" cy="10" r="1.2" fill="#37a22b" />
    </svg>
  );
}

function ViewerTitleGlyph({ type }: { type: ViewerWindow["file"]["type"] }) {
  if (type === "pdf") return <PdfGlyph />;
  if (type === "image" || type === "video") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="1.5" y="3.5" width="17" height="13" rx="1.5" fill="#3E6BC4" stroke="#26446e" strokeWidth=".8" />
        <circle cx="7" cy="8.5" r="2" fill="#ffd76e" />
        <path d="M3 14.5 8 10l4 3.4 2.6-2 2.4 3.1z" fill="#3fa73f" />
      </svg>
    );
  }
  return <TextFileGlyph />;
}

/** Icon (or real thumbnail) for a grid entry. */
function ItemIcon({ node }: { node: ExplorerNode }) {
  if (node.kind === "folder") {
    return (
      <span className="explorer-item-icon is-folder">
        <FolderGlyph />
      </span>
    );
  }
  switch (node.type) {
    case "image":
      return (
        <span className="explorer-item-icon is-thumb">
          <img src={node.src} alt="" loading="lazy" draggable={false} />
        </span>
      );
    case "video":
      return (
        <span className="explorer-item-icon is-thumb">
          <img src={node.poster} alt="" loading="lazy" draggable={false} />
          <svg className="explorer-thumb-play" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="9" fill="rgb(0 0 0 / 0.55)" stroke="#fff" strokeWidth="1.2" />
            <polygon points="8,6 15,10 8,14" fill="#fff" />
          </svg>
        </span>
      );
    case "url":
      return (
        <span className="explorer-item-icon">
          {node.href.includes("github.com") ? (
            <img src="/xp/gui/start-menu/github.webp" alt="" draggable={false} />
          ) : (
            <GlobeGlyph />
          )}
          <svg className="explorer-shortcut-arrow" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="0" y="0" width="10" height="10" fill="#fff" stroke="#7f7f7f" strokeWidth="0.6" />
            <path d="M2.5 7.5V4.7c0-1.2 1-2.2 2.2-2.2h1.6M4.6 1 6.9 2.5 4.6 4z" fill="none" stroke="#000" strokeWidth="1" />
            <path d="M4.9 1.1 6.9 2.5 4.9 3.9z" fill="#000" />
          </svg>
        </span>
      );
    case "pdf":
      return (
        <span className="explorer-item-icon">
          <PdfGlyph />
        </span>
      );
    default:
      return (
        <span className="explorer-item-icon">
          <TextFileGlyph />
        </span>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Child viewer window                                                 */
/* ------------------------------------------------------------------ */

function TxtViewerBody({ file }: { file: Extract<ExplorerFile, { type: "txt" }> }) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [wordWrap, setWordWrap] = useState(true);
  const [caret, setCaret] = useState({ line: 1, column: 1 });

  const updateCaret = () => {
    const area = textareaRef.current;
    if (!area) return;
    const before = area.value.slice(0, area.selectionStart ?? 0).split("\n");
    setCaret({ line: before.length, column: (before[before.length - 1]?.length ?? 0) + 1 });
  };

  const menus: WindowMenu[] = [
    {
      label: "Edit",
      items: [
        {
          label: "Select All",
          onSelect: () => {
            textareaRef.current?.focus();
            textareaRef.current?.select();
          },
        },
        {
          label: "Copy All",
          onSelect: () => {
            void navigator.clipboard?.writeText(file.content).catch(() => {});
          },
        },
      ],
    },
    {
      label: "Format",
      items: [{ label: "Word Wrap", checked: wordWrap, onSelect: () => setWordWrap((value) => !value) }],
    },
    { label: "View", items: [{ label: "Status Bar", checked: true, disabled: true }] },
  ];

  return (
    <>
      <MenuBar menus={menus} ariaLabel={`${file.name} menu`} />
      <textarea
        ref={textareaRef}
        className="explorer-notepad-body"
        value={file.content}
        readOnly
        spellCheck={false}
        wrap={wordWrap ? "soft" : "off"}
        onSelect={updateCaret}
        onKeyUp={updateCaret}
        onClick={updateCaret}
      />
      <footer className="explorer-notepad-status">
        <span>{file.content.split("\n").length} lines</span>
        <span>
          Ln {caret.line}, Col {caret.column}
        </span>
      </footer>
    </>
  );
}

function ImageViewerBody({
  file,
  gallery,
}: {
  file: ImageFile;
  gallery: ImageFile[];
}) {
  const startIndex = Math.max(0, gallery.findIndex((entry) => entry.name === file.name));
  const [index, setIndex] = useState(startIndex);
  const current = gallery[index] ?? file;

  return (
    <>
      <div className="viewer-image-stage">
        <img src={current.src} alt={current.caption} draggable={false} />
      </div>
      <footer className="viewer-media-toolbar">
        <button
          type="button"
          className="xp-control"
          aria-label="Previous picture"
          disabled={index <= 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          ◀
        </button>
        <span className="viewer-media-caption" title={current.caption}>
          {index + 1} of {gallery.length} · {current.name}
        </span>
        <button
          type="button"
          className="xp-control"
          aria-label="Next picture"
          disabled={index >= gallery.length - 1}
          onClick={() => setIndex((value) => Math.min(gallery.length - 1, value + 1))}
        >
          ▶
        </button>
      </footer>
    </>
  );
}

function VideoViewerBody({ file }: { file: Extract<ExplorerFile, { type: "video" }> }) {
  return (
    <>
      <div className="viewer-video-stage">
        <video src={file.src} poster={file.poster} controls playsInline preload="metadata" />
      </div>
      <footer className="explorer-notepad-status">
        <span className="viewer-media-caption">{file.caption}</span>
        <span>{sizeLabel(file.sizeBytes)}</span>
      </footer>
    </>
  );
}

function PdfViewerBody({ file }: { file: Extract<ExplorerFile, { type: "pdf" }> }) {
  return (
    <>
      <iframe className="viewer-pdf-frame" src={`${file.src}#toolbar=0&navpanes=0&view=FitH`} title={file.name} />
      <footer className="explorer-notepad-status">
        <a href={file.src} download>
          Save a Copy
        </a>
        <span>{sizeLabel(file.sizeBytes)}</span>
      </footer>
    </>
  );
}

function ViewerPane({
  pad,
  active,
  onFocus,
  onClose,
  onToggleMaximize,
  onDragStart,
  onResizeStart,
}: {
  pad: ViewerWindow;
  active: boolean;
  onFocus: (id: number) => void;
  onClose: (id: number) => void;
  onToggleMaximize: (id: number) => void;
  onDragStart: (event: ReactPointerEvent, pad: ViewerWindow) => void;
  onResizeStart: (event: ReactPointerEvent, pad: ViewerWindow) => void;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);

  // Animate out before unmounting, mirroring the shell's window motion.
  const handleClose = () => {
    if (closingRef.current) return;
    const element = sectionRef.current;
    if (!element || prefersReducedMotion() || typeof element.animate !== "function") {
      onClose(pad.id);
      return;
    }
    closingRef.current = true;
    const animation = element.animate(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.95)" },
      ],
      { duration: 130, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" },
    );
    void animation.finished.then(() => onClose(pad.id)).catch(() => onClose(pad.id));
  };

  const style = pad.maximized
    ? { zIndex: pad.z }
    : { left: pad.x, top: pad.y, width: pad.width, height: pad.height, zIndex: pad.z };

  const title = `${pad.file.name} - ${VIEWER_TITLE_SUFFIX[pad.file.type]}`;

  return (
    <section
      ref={sectionRef}
      className={cn(
        "explorer-notepad",
        `is-${pad.file.type}-viewer`,
        pad.file.type !== "txt" && "is-no-menu",
        active && "is-active",
        pad.maximized && "is-maximized",
      )}
      style={style}
      aria-label={title}
      onPointerDown={() => onFocus(pad.id)}
    >
      <header
        className="explorer-notepad-titlebar"
        onPointerDown={(event) => onDragStart(event, pad)}
        onDoubleClick={(event) => {
          if ((event.target as Element).closest("button")) return;
          onToggleMaximize(pad.id);
        }}
      >
        <span className="explorer-notepad-icon">
          <ViewerTitleGlyph type={pad.file.type} />
        </span>
        <strong>{title}</strong>
        <button
          type="button"
          className="np-max"
          aria-label={`${pad.maximized ? "Restore" : "Maximize"} ${pad.file.name}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onToggleMaximize(pad.id)}
        >
          □
        </button>
        <button
          type="button"
          className="np-close"
          aria-label={`Close ${pad.file.name}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={handleClose}
        >
          ×
        </button>
      </header>

      {pad.file.type === "txt" ? <TxtViewerBody file={pad.file} /> : null}
      {pad.file.type === "image" ? <ImageViewerBody file={pad.file} gallery={pad.gallery} /> : null}
      {pad.file.type === "video" ? <VideoViewerBody file={pad.file} /> : null}
      {pad.file.type === "pdf" ? <PdfViewerBody file={pad.file} /> : null}

      {!pad.maximized ? (
        <div
          className="explorer-notepad-resize"
          aria-hidden="true"
          onPointerDown={(event) => onResizeStart(event, pad)}
        />
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Explorer                                                            */
/* ------------------------------------------------------------------ */

export function FileExplorerApp() {
  // Path of folder names below My Documents; [] is the root.
  const [path, setPath] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [docsExpanded, setDocsExpanded] = useState(true);
  const [viewers, setViewers] = useState<ViewerWindow[]>([]);
  const [drag, setDrag] = useState<ViewerDrag | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(0);
  const zRef = useRef(10);
  const openedRef = useRef(0);

  const folder = resolveFolder(path);
  const selectedNode = folder.children.find((child) => child.name === selected) ?? null;
  const addressPath = [MY_DOCUMENTS_PATH, ...path].join("\\");
  const topViewer = viewers.reduce<ViewerWindow | null>(
    (top, pad) => (top && top.z > pad.z ? top : pad),
    null,
  );

  const navigate = (nextPath: string[]) => {
    setPath(nextPath);
    setSelected(null);
    playSfx("menu");
  };

  const focusViewer = (id: number) => {
    setViewers((current) =>
      current.map((pad) => (pad.id === id ? { ...pad, z: ++zRef.current } : pad)),
    );
  };

  const openFile = (file: ExplorerFile) => {
    playSfx("ding");
    if (file.type === "url") {
      window.open(file.href, "_blank", "noopener,noreferrer");
      return;
    }
    setViewers((current) => {
      const existing = current.find((pad) => pad.file.name === file.name);
      if (existing) {
        return current.map((pad) => (pad.id === existing.id ? { ...pad, z: ++zRef.current } : pad));
      }
      const bounds = bodyRef.current?.getBoundingClientRect();
      const boundsWidth = bounds?.width ?? 640;
      const boundsHeight = bounds?.height ?? 480;
      const defaults = VIEWER_DEFAULT_SIZE[file.type];
      const cascade = (openedRef.current++ % 6) * CASCADE_STEP;
      const width = Math.min(defaults.width, Math.max(VIEWER_MIN_WIDTH, boundsWidth - 24));
      const height = Math.min(defaults.height, Math.max(VIEWER_MIN_HEIGHT, boundsHeight - 24));
      const x = Math.max(4, Math.min(28 + cascade, boundsWidth - width - 4));
      const y = Math.max(4, Math.min(18 + cascade, boundsHeight - height - 4));
      const gallery =
        file.type === "image"
          ? folder.children.filter((child): child is ImageFile => child.kind === "file" && child.type === "image")
          : [];
      return [
        ...current,
        { id: ++idRef.current, file, gallery, x, y, width, height, z: ++zRef.current, maximized: false },
      ];
    });
  };

  const closeViewer = (id: number) => {
    setViewers((current) => current.filter((pad) => pad.id !== id));
  };

  const toggleMaximize = (id: number) => {
    setViewers((current) =>
      current.map((pad) =>
        pad.id === id ? { ...pad, maximized: !pad.maximized, z: ++zRef.current } : pad,
      ),
    );
  };

  const startViewerDrag = (event: ReactPointerEvent, pad: ViewerWindow) => {
    if (pad.maximized) return;
    event.preventDefault();
    focusViewer(pad.id);
    setDrag({
      mode: "move",
      id: pad.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: pad.x,
      originY: pad.y,
    });
  };

  const startViewerResize = (event: ReactPointerEvent, pad: ViewerWindow) => {
    event.preventDefault();
    event.stopPropagation();
    focusViewer(pad.id);
    setDrag({
      mode: "resize",
      id: pad.id,
      startX: event.clientX,
      startY: event.clientY,
      width: pad.width,
      height: pad.height,
    });
  };

  useEffect(() => {
    if (!drag) return;

    const handleMove = (event: PointerEvent) => {
      const bounds = bodyRef.current?.getBoundingClientRect();
      setViewers((current) =>
        current.map((pad) => {
          if (pad.id !== drag.id) return pad;
          if (drag.mode === "move") {
            const maxX = (bounds?.width ?? 640) - 60;
            const maxY = (bounds?.height ?? 480) - 26;
            return {
              ...pad,
              x: Math.max(60 - pad.width, Math.min(maxX, drag.originX + event.clientX - drag.startX)),
              y: Math.max(0, Math.min(maxY, drag.originY + event.clientY - drag.startY)),
            };
          }
          return {
            ...pad,
            width: Math.max(VIEWER_MIN_WIDTH, drag.width + event.clientX - drag.startX),
            height: Math.max(VIEWER_MIN_HEIGHT, drag.height + event.clientY - drag.startY),
          };
        }),
      );
    };

    const stop = () => setDrag(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stop, { once: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stop);
    };
  }, [drag]);

  const subfolders = myDocuments.children.filter((child) => child.kind === "folder");

  return (
    <div
      className="file-explorer"
      onKeyDown={(event) => {
        if (event.key === "Escape" && topViewer) closeViewer(topViewer.id);
      }}
    >
      <div className="explorer-body" ref={bodyRef}>
        <aside className="explorer-sidebar" aria-label="Folders">
          <div className="explorer-sidebar-heading">
            <span>Folders</span>
          </div>
          <div className="explorer-tree" role="tree">
            <div className="explorer-tree-row" style={{ "--depth": 0 } as React.CSSProperties} aria-hidden="true">
              <span className="explorer-tree-pm">-</span>
              <ComputerGlyph />
              <span>Desktop</span>
            </div>
            <button
              type="button"
              role="treeitem"
              aria-selected={path.length === 0}
              aria-expanded={docsExpanded}
              className={cn("explorer-tree-row is-link", path.length === 0 && "is-selected")}
              style={{ "--depth": 1 } as React.CSSProperties}
              onClick={() => navigate([])}
            >
              <span
                className="explorer-tree-pm is-toggle"
                onClick={(event) => {
                  event.stopPropagation();
                  setDocsExpanded((value) => !value);
                }}
              >
                {docsExpanded ? "-" : "+"}
              </span>
              <FolderGlyph />
              <span>My Documents</span>
            </button>
            {docsExpanded
              ? subfolders.map((child) => (
                  <button
                    key={child.name}
                    type="button"
                    role="treeitem"
                    aria-selected={path[0] === child.name}
                    className={cn("explorer-tree-row is-link", path[0] === child.name && "is-selected")}
                    style={{ "--depth": 2 } as React.CSSProperties}
                    onClick={() => navigate([child.name])}
                  >
                    <span className="explorer-tree-pm">+</span>
                    <FolderGlyph />
                    <span>{child.name}</span>
                  </button>
                ))
              : null}
            <div className="explorer-tree-row" style={{ "--depth": 1 } as React.CSSProperties} aria-hidden="true">
              <span className="explorer-tree-pm">+</span>
              <ComputerGlyph />
              <span>My Computer</span>
            </div>
            <div className="explorer-tree-row" style={{ "--depth": 2 } as React.CSSProperties} aria-hidden="true">
              <span className="explorer-tree-pm">+</span>
              <DriveGlyph />
              <span>Local Disk (C:)</span>
            </div>
            <div className="explorer-tree-row" style={{ "--depth": 2 } as React.CSSProperties} aria-hidden="true">
              <span className="explorer-tree-pm">+</span>
              <DriveGlyph />
              <span>Local Disk (D:)</span>
            </div>
          </div>
        </aside>

        <div
          className="explorer-content"
          onPointerDown={(event) => {
            if (!(event.target as Element).closest(".explorer-item")) setSelected(null);
          }}
        >
          {/* XP "web view" single-click semantics: point to select, click to open. */}
          <div className="explorer-grid" role="list" aria-label={folder.name}>
            {folder.children.map((child) => {
              const open = child.kind === "folder" ? () => navigate([child.name]) : () => openFile(child);
              return (
                <button
                  key={child.name}
                  type="button"
                  role="listitem"
                  title={infotip(child)}
                  className={cn("explorer-item", selected === child.name && "is-selected")}
                  onPointerEnter={() => setSelected(child.name)}
                  onClick={open}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      open();
                    }
                  }}
                >
                  <ItemIcon node={child} />
                  <span className="explorer-item-name">{child.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {viewers.map((pad) => (
          <ViewerPane
            key={pad.id}
            pad={pad}
            active={topViewer?.id === pad.id}
            onFocus={focusViewer}
            onClose={closeViewer}
            onToggleMaximize={toggleMaximize}
            onDragStart={startViewerDrag}
            onResizeStart={startViewerResize}
          />
        ))}
      </div>

      <footer className="explorer-statusbar">
        <span>{selectedNode ? "1 object selected" : `${folder.children.length} objects`}</span>
        <span>{selectedNode ? sizeLabel(nodeSizeBytes(selectedNode)) : folderSizeLabel(folder)}</span>
        <span className="explorer-statusbar-path" title={addressPath}>
          <FolderGlyph />
          {addressPath}
        </span>
      </footer>
    </div>
  );
}
