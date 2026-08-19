/**
 * My Documents — an XP Explorer view over the portfolio's virtual filesystem
 * (src/data/files.ts). Folders pane on the left, icon grid on the right, and
 * double-clicked files open in draggable, resizable Notepad child windows
 * stacked inside the explorer body, cascade-offset like the real thing.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "../lib/cn";
import { playSfx } from "../xp/audio";
import {
  MY_DOCUMENTS_PATH,
  folderSizeLabel,
  myDocuments,
  resolveFolder,
  type ExplorerFile,
} from "../data/files";

const NOTEPAD_MIN_WIDTH = 260;
const NOTEPAD_MIN_HEIGHT = 180;
const NOTEPAD_DEFAULT_WIDTH = 430;
const NOTEPAD_DEFAULT_HEIGHT = 330;
const CASCADE_STEP = 26;

type NotepadWindow = {
  id: number;
  file: ExplorerFile;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
};

type NotepadDrag =
  | { mode: "move"; id: number; startX: number; startY: number; originX: number; originY: number }
  | { mode: "resize"; id: number; startX: number; startY: number; width: number; height: number };

function FolderGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M1 5.5c0-.8.7-1.5 1.5-1.5H8l1.6 2H17.5c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-15C1.7 18 1 17.3 1 16.5v-11z"
        fill="#F6C13A"
        stroke="#B8860B"
        strokeWidth=".5"
      />
      <path d="M1 8h18v8.5c0 .8-.7 1.5-1.5 1.5h-15C1.7 18 1 17.3 1 16.5V8z" fill="#FFD97A" opacity=".55" />
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

function NotepadPane({
  window: pad,
  active,
  onFocus,
  onClose,
  onDragStart,
  onResizeStart,
}: {
  window: NotepadWindow;
  active: boolean;
  onFocus: (id: number) => void;
  onClose: (id: number) => void;
  onDragStart: (event: ReactPointerEvent, pad: NotepadWindow) => void;
  onResizeStart: (event: ReactPointerEvent, pad: NotepadWindow) => void;
}) {
  const lineCount = pad.file.content.split("\n").length;
  return (
    <section
      className={cn("explorer-notepad", active && "is-active")}
      style={{ left: pad.x, top: pad.y, width: pad.width, height: pad.height, zIndex: pad.z }}
      aria-label={`${pad.file.name} — Notepad`}
      onPointerDown={() => onFocus(pad.id)}
    >
      <header className="explorer-notepad-titlebar" onPointerDown={(event) => onDragStart(event, pad)}>
        <span className="explorer-notepad-icon">
          <TextFileGlyph />
        </span>
        <strong>{pad.file.name} - Notepad</strong>
        <button
          type="button"
          aria-label={`Close ${pad.file.name}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onClose(pad.id)}
        >
          ×
        </button>
      </header>
      <div className="explorer-notepad-menu" aria-hidden="true">
        <span>File</span>
        <span>Edit</span>
        <span>Format</span>
        <span>View</span>
        <span>Help</span>
      </div>
      <textarea className="explorer-notepad-body" value={pad.file.content} readOnly spellCheck={false} />
      <footer className="explorer-notepad-status">
        <span>{lineCount} lines</span>
        <span>Ln 1, Col 1</span>
      </footer>
      <div
        className="explorer-notepad-resize"
        aria-hidden="true"
        onPointerDown={(event) => onResizeStart(event, pad)}
      />
    </section>
  );
}

export function FileExplorerApp() {
  // Path of folder names below My Documents; [] is the root.
  const [path, setPath] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [notepads, setNotepads] = useState<NotepadWindow[]>([]);
  const [drag, setDrag] = useState<NotepadDrag | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(0);
  const zRef = useRef(10);
  const openedRef = useRef(0);

  const folder = resolveFolder(path);
  const addressPath = [MY_DOCUMENTS_PATH, ...path].join("\\");
  const topNotepad = notepads.reduce<NotepadWindow | null>(
    (top, pad) => (top && top.z > pad.z ? top : pad),
    null,
  );

  const navigate = useCallback((nextPath: string[]) => {
    setPath(nextPath);
    setSelected(null);
    playSfx("menu");
  }, []);

  const focusNotepad = useCallback((id: number) => {
    setNotepads((current) =>
      current.map((pad) => (pad.id === id ? { ...pad, z: ++zRef.current } : pad)),
    );
  }, []);

  const openFile = useCallback((file: ExplorerFile) => {
    setSelected(null);
    playSfx("ding");
    setNotepads((current) => {
      const existing = current.find((pad) => pad.file.name === file.name);
      if (existing) {
        return current.map((pad) => (pad.id === existing.id ? { ...pad, z: ++zRef.current } : pad));
      }
      const bounds = bodyRef.current?.getBoundingClientRect();
      const cascade = (openedRef.current++ % 6) * CASCADE_STEP;
      const width = Math.min(NOTEPAD_DEFAULT_WIDTH, Math.max(NOTEPAD_MIN_WIDTH, (bounds?.width ?? 640) - 24));
      const height = Math.min(NOTEPAD_DEFAULT_HEIGHT, Math.max(NOTEPAD_MIN_HEIGHT, (bounds?.height ?? 480) - 24));
      const x = Math.max(4, Math.min(28 + cascade, (bounds?.width ?? 640) - width - 4));
      const y = Math.max(4, Math.min(18 + cascade, (bounds?.height ?? 480) - height - 4));
      return [...current, { id: ++idRef.current, file, x, y, width, height, z: ++zRef.current }];
    });
  }, []);

  const closeNotepad = useCallback((id: number) => {
    setNotepads((current) => current.filter((pad) => pad.id !== id));
  }, []);

  // XP semantics with a touch-friendly twist: first click selects, a second
  // click (or a double click, or Enter) on the selected item opens it.
  const handleItemClick = useCallback(
    (name: string, open: () => void) => {
      if (selected === name) open();
      else setSelected(name);
    },
    [selected],
  );

  const startNotepadDrag = useCallback((event: ReactPointerEvent, pad: NotepadWindow) => {
    event.preventDefault();
    focusNotepad(pad.id);
    setDrag({
      mode: "move",
      id: pad.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: pad.x,
      originY: pad.y,
    });
  }, [focusNotepad]);

  const startNotepadResize = useCallback((event: ReactPointerEvent, pad: NotepadWindow) => {
    event.preventDefault();
    event.stopPropagation();
    focusNotepad(pad.id);
    setDrag({
      mode: "resize",
      id: pad.id,
      startX: event.clientX,
      startY: event.clientY,
      width: pad.width,
      height: pad.height,
    });
  }, [focusNotepad]);

  useEffect(() => {
    if (!drag) return;

    const handleMove = (event: PointerEvent) => {
      const bounds = bodyRef.current?.getBoundingClientRect();
      setNotepads((current) =>
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
            width: Math.max(NOTEPAD_MIN_WIDTH, drag.width + event.clientX - drag.startX),
            height: Math.max(NOTEPAD_MIN_HEIGHT, drag.height + event.clientY - drag.startY),
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
    <div className="file-explorer">
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
              className={cn("explorer-tree-row is-link", path.length === 0 && "is-selected")}
              style={{ "--depth": 1 } as React.CSSProperties}
              onClick={() => navigate([])}
            >
              <span className="explorer-tree-pm">-</span>
              <FolderGlyph />
              <span>My Documents</span>
            </button>
            {subfolders.map((child) => (
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
            ))}
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
          <div className="explorer-grid" role="list" aria-label={folder.name}>
            {folder.children.map((child) =>
              child.kind === "folder" ? (
                <button
                  key={child.name}
                  type="button"
                  role="listitem"
                  className={cn("explorer-item", selected === child.name && "is-selected")}
                  onClick={() => handleItemClick(child.name, () => navigate([child.name]))}
                  onDoubleClick={() => navigate([child.name])}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      navigate([child.name]);
                    }
                  }}
                >
                  <span className="explorer-item-icon is-folder">
                    <FolderGlyph />
                  </span>
                  <span className="explorer-item-name">{child.name}</span>
                </button>
              ) : (
                <button
                  key={child.name}
                  type="button"
                  role="listitem"
                  className={cn("explorer-item", selected === child.name && "is-selected")}
                  onClick={() => handleItemClick(child.name, () => openFile(child))}
                  onDoubleClick={() => openFile(child)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      openFile(child);
                    }
                  }}
                >
                  <span className="explorer-item-icon">
                    <TextFileGlyph />
                  </span>
                  <span className="explorer-item-name">{child.name}</span>
                </button>
              ),
            )}
          </div>
        </div>

        {notepads.map((pad) => (
          <NotepadPane
            key={pad.id}
            window={pad}
            active={topNotepad?.id === pad.id}
            onFocus={focusNotepad}
            onClose={closeNotepad}
            onDragStart={startNotepadDrag}
            onResizeStart={startNotepadResize}
          />
        ))}
      </div>

      <footer className="explorer-statusbar">
        <span>{folder.children.length} objects</span>
        <span>{folderSizeLabel(folder)}</span>
        <span className="explorer-statusbar-path" title={addressPath}>
          <FolderGlyph />
          {addressPath}
        </span>
      </footer>
    </div>
  );
}
