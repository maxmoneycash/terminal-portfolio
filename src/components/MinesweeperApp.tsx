/**
 * Minesweeper — the XP classic, faithfully rebuilt: silver bevels, seven-
 * segment counters, the smiley, colored numbers, first-click safety, flood
 * fill, chording, and best times. Right-click (or long-press / flag mode on
 * touch) plants flags. The Game menu lives inside the window, like the
 * original.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { playSfx } from "../xp/audio";
import { MenuBar, type WindowMenu } from "./MenuBar";

type Difficulty = "beginner" | "intermediate" | "expert";

const DIFFICULTIES: Record<Difficulty, { rows: number; cols: number; mines: number; label: string }> = {
  beginner: { rows: 9, cols: 9, mines: 10, label: "Beginner" },
  intermediate: { rows: 16, cols: 16, mines: 40, label: "Intermediate" },
  expert: { rows: 16, cols: 30, mines: 99, label: "Expert" },
};

const BEST_TIMES_KEY = "maxxp:minesweeper:best";
const LONG_PRESS_MS = 350;

type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
  /** Set on the mine that ended the game. */
  detonated?: boolean;
};

type Status = "idle" | "playing" | "won" | "lost";

const NUMBER_CLASSES = ["", "is-1", "is-2", "is-3", "is-4", "is-5", "is-6", "is-7", "is-8"];

/* ------------------------------------------------------------------ */
/* Board helpers                                                       */
/* ------------------------------------------------------------------ */

function emptyBoard(rows: number, cols: number): Cell[] {
  return Array.from({ length: rows * cols }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    adjacent: 0,
  }));
}

function neighborsOf(index: number, rows: number, cols: number): number[] {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const result: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) result.push(r * cols + c);
    }
  }
  return result;
}

/** Mines are placed on the first reveal so the first click is never a mine. */
function mineBoard(rows: number, cols: number, mines: number, safeIndex: number): Cell[] {
  const board = emptyBoard(rows, cols);
  const candidates = board.map((_, index) => index).filter((index) => index !== safeIndex);
  for (let placed = 0; placed < mines; placed += 1) {
    const pick = Math.floor(Math.random() * candidates.length);
    board[candidates[pick]].mine = true;
    candidates.splice(pick, 1);
  }
  board.forEach((cell, index) => {
    if (cell.mine) return;
    cell.adjacent = neighborsOf(index, rows, cols).filter((n) => board[n].mine).length;
  });
  return board;
}

function revealFrom(board: Cell[], start: number, rows: number, cols: number) {
  const queue = [start];
  while (queue.length > 0) {
    const index = queue.pop()!;
    const cell = board[index];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.adjacent === 0 && !cell.mine) {
      neighborsOf(index, rows, cols).forEach((n) => {
        if (!board[n].revealed && !board[n].flagged) queue.push(n);
      });
    }
  }
}

function readBestTimes(): Partial<Record<Difficulty, number>> {
  try {
    return JSON.parse(window.localStorage.getItem(BEST_TIMES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Seven-segment counter, drawn like the original LED panels           */
/* ------------------------------------------------------------------ */

//    _a_
//  f|_g_|b     segment order: a b c d e f g
//  e|___|c
//    d
const SEGMENT_SHAPES = [
  "2,1 10,1 8.5,3 3.5,3",
  "10.5,1.5 10.5,10 8.5,8.5 8.5,3.5",
  "10.5,11 10.5,19.5 8.5,17.5 8.5,12.5",
  "2,20 10,20 8.5,18 3.5,18",
  "1.5,11 1.5,19.5 3.5,17.5 3.5,12.5",
  "1.5,1.5 1.5,10 3.5,8.5 3.5,3.5",
  "2.2,10.5 3.7,9.5 8.3,9.5 9.8,10.5 8.3,11.5 3.7,11.5",
];

const DIGIT_SEGMENTS: Record<string, number[]> = {
  "0": [1, 1, 1, 1, 1, 1, 0],
  "1": [0, 1, 1, 0, 0, 0, 0],
  "2": [1, 1, 0, 1, 1, 0, 1],
  "3": [1, 1, 1, 1, 0, 0, 1],
  "4": [0, 1, 1, 0, 0, 1, 1],
  "5": [1, 0, 1, 1, 0, 1, 1],
  "6": [1, 0, 1, 1, 1, 1, 1],
  "7": [1, 1, 1, 0, 0, 0, 0],
  "8": [1, 1, 1, 1, 1, 1, 1],
  "9": [1, 1, 1, 1, 0, 1, 1],
  "-": [0, 0, 0, 0, 0, 0, 1],
};

function LedCounter({ value, label }: { value: number; label: string }) {
  const text = String(Math.max(-99, Math.min(999, Math.trunc(value)))).padStart(3, "0");
  return (
    <span className="mine-led" role="status" aria-label={`${label}: ${text}`}>
      {text.split("").map((char, digitIndex) => (
        <svg key={digitIndex} viewBox="0 0 12 21" aria-hidden="true">
          {SEGMENT_SHAPES.map((points, segment) => (
            <polygon
              key={segment}
              points={points}
              fill={DIGIT_SEGMENTS[char]?.[segment] ? "#ff2600" : "#4d0800"}
            />
          ))}
        </svg>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tiny glyphs                                                         */
/* ------------------------------------------------------------------ */

function MineGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <line x1="8" y1="1" x2="8" y2="15" stroke="#000" strokeWidth="1.4" />
      <line x1="1" y1="8" x2="15" y2="8" stroke="#000" strokeWidth="1.4" />
      <line x1="3" y1="3" x2="13" y2="13" stroke="#000" strokeWidth="1.1" />
      <line x1="13" y1="3" x2="3" y2="13" stroke="#000" strokeWidth="1.1" />
      <circle cx="8" cy="8" r="4.6" fill="#000" />
      <rect x="5.6" y="5.6" width="2" height="2" fill="#fff" />
    </svg>
  );
}

function FlagGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <polygon points="9,2 9,7 3.5,4.5" fill="#e00" />
      <line x1="9" y1="2" x2="9" y2="12" stroke="#000" strokeWidth="1.2" />
      <rect x="5" y="12" width="8" height="2.2" fill="#000" />
    </svg>
  );
}

function Face({ status, pressing }: { status: Status; pressing: boolean }) {
  return (
    <svg viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="11.5" fill="#ffe900" stroke="#000" strokeWidth="1.4" />
      {status === "lost" ? (
        <g stroke="#000" strokeWidth="1.4">
          <line x1="7.5" y1="8" x2="11" y2="11.5" />
          <line x1="11" y1="8" x2="7.5" y2="11.5" />
          <line x1="15" y1="8" x2="18.5" y2="11.5" />
          <line x1="18.5" y1="8" x2="15" y2="11.5" />
          <path d="M8 19 Q13 14.5 18 19" fill="none" />
        </g>
      ) : status === "won" ? (
        <g>
          <path d="M5.5 9.5 h6 l-1 3.5 h-4 z" fill="#000" />
          <path d="M14.5 9.5 h6 l-1 3.5 h-4 z" fill="#000" />
          <line x1="11.5" y1="10" x2="14.5" y2="10" stroke="#000" strokeWidth="1.2" />
          <path d="M8 17.5 Q13 21.5 18 17.5" fill="none" stroke="#000" strokeWidth="1.4" />
        </g>
      ) : pressing ? (
        <g>
          <circle cx="9.5" cy="10" r="1.4" fill="#000" />
          <circle cx="16.5" cy="10" r="1.4" fill="#000" />
          <circle cx="13" cy="17.5" r="2.2" fill="none" stroke="#000" strokeWidth="1.3" />
        </g>
      ) : (
        <g>
          <circle cx="9.5" cy="10" r="1.4" fill="#000" />
          <circle cx="16.5" cy="10" r="1.4" fill="#000" />
          <path d="M8 16.5 Q13 20.5 18 16.5" fill="none" stroke="#000" strokeWidth="1.4" />
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* The game                                                            */
/* ------------------------------------------------------------------ */

export function MinesweeperApp() {
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const { rows, cols, mines, label } = DIFFICULTIES[difficulty];
  const [board, setBoard] = useState<Cell[]>(() => emptyBoard(9, 9));
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [pressing, setPressing] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [showBestTimes, setShowBestTimes] = useState(false);
  const [bestTimes, setBestTimes] = useState(readBestTimes);
  const longPressRef = useRef<{ timer: number; fired: boolean } | null>(null);

  const flags = useMemo(() => board.filter((cell) => cell.flagged).length, [board]);
  const revealedCount = useMemo(() => board.filter((cell) => cell.revealed).length, [board]);
  const gameOver = status === "won" || status === "lost";

  // XP behavior: the counter jumps to 1 on the first reveal, then ticks.
  useEffect(() => {
    if (status !== "playing") return;
    setElapsed(1);
    const timer = window.setInterval(() => setElapsed((value) => Math.min(999, value + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const reset = (next: Difficulty = difficulty) => {
    const config = DIFFICULTIES[next];
    setDifficulty(next);
    setBoard(emptyBoard(config.rows, config.cols));
    setStatus("idle");
    setElapsed(0);
    setShowBestTimes(false);
  };

  const commitLoss = (next: Cell[], detonatedIndex: number) => {
    next.forEach((cell, index) => {
      if (cell.mine) cell.revealed = true;
      if (index === detonatedIndex) cell.detonated = true;
    });
    setBoard(next);
    setStatus("lost");
    playSfx("critical");
  };

  const commitAndCheckWin = (next: Cell[]) => {
    const revealed = next.filter((cell) => cell.revealed).length;
    if (revealed === rows * cols - mines) {
      next.forEach((cell) => {
        if (cell.mine) cell.flagged = true;
      });
      setBoard(next);
      setStatus("won");
      playSfx("ding");
      const best = bestTimes[difficulty];
      if (best === undefined || elapsed < best) {
        const record = { ...bestTimes, [difficulty]: elapsed };
        setBestTimes(record);
        try {
          window.localStorage.setItem(BEST_TIMES_KEY, JSON.stringify(record));
        } catch {
          // Storage optional.
        }
      }
      return;
    }
    setBoard(next);
  };

  const reveal = (index: number) => {
    if (gameOver) return;
    const cell = board[index];
    if (cell.revealed || cell.flagged) return;
    let next = board.map((entry) => ({ ...entry }));
    if (status === "idle") {
      next = mineBoard(rows, cols, mines, index);
      setStatus("playing");
    }
    if (next[index].mine) {
      commitLoss(next, index);
      return;
    }
    revealFrom(next, index, rows, cols);
    commitAndCheckWin(next);
  };

  const toggleFlag = (index: number) => {
    if (gameOver) return;
    const cell = board[index];
    if (cell.revealed) return;
    const next = board.map((entry) => ({ ...entry }));
    next[index].flagged = !next[index].flagged;
    setBoard(next);
  };

  /** Chord: a revealed number with the right flag count opens its neighbors. */
  const chord = (index: number) => {
    if (gameOver) return;
    const cell = board[index];
    if (!cell.revealed || cell.adjacent === 0) return;
    const around = neighborsOf(index, rows, cols);
    const flagged = around.filter((n) => board[n].flagged).length;
    if (flagged !== cell.adjacent) return;
    const next = board.map((entry) => ({ ...entry }));
    for (const n of around) {
      if (next[n].flagged || next[n].revealed) continue;
      if (next[n].mine) {
        commitLoss(next, n);
        return;
      }
      revealFrom(next, n, rows, cols);
    }
    commitAndCheckWin(next);
  };

  const handleCellActivate = (index: number, cell: Cell) => {
    if (longPressRef.current?.fired) {
      longPressRef.current = null;
      return;
    }
    if (cell.revealed) {
      chord(index);
    } else if (flagMode) {
      toggleFlag(index);
    } else {
      reveal(index);
    }
  };

  const startLongPress = (index: number, pointerType: string) => {
    setPressing(true);
    if (pointerType !== "touch") return;
    const timer = window.setTimeout(() => {
      if (longPressRef.current) longPressRef.current.fired = true;
      toggleFlag(index);
    }, LONG_PRESS_MS);
    longPressRef.current = { timer, fired: false };
  };

  const endLongPress = () => {
    setPressing(false);
    const pending = longPressRef.current;
    if (!pending) return;
    if (!pending.fired) {
      window.clearTimeout(pending.timer);
      longPressRef.current = null;
    } else {
      // Let the synthetic click after the long-press be swallowed, then reset.
      window.setTimeout(() => {
        longPressRef.current = null;
      }, 300);
    }
  };

  const menus: WindowMenu[] = [
    {
      label: "Game",
      items: [
        { label: "New", onSelect: () => reset() },
        "separator",
        ...(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => ({
          label: DIFFICULTIES[key].label,
          checked: difficulty === key,
          onSelect: () => reset(key),
        })),
        "separator",
        { label: "Best Times…", onSelect: () => setShowBestTimes(true) },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Left-click: reveal", disabled: true },
        { label: "Right-click / long-press: flag", disabled: true },
        { label: "Click a number: chord", disabled: true },
      ],
    },
  ];

  return (
    <div className="minesweeper-app">
      <MenuBar menus={menus} ariaLabel="Minesweeper menu" />
      <div className="mine-scroll">
        <div className="mine-frame" style={{ "--mine-cols": cols } as React.CSSProperties}>
          <div className="mine-header">
            <LedCounter value={mines - flags} label="Mines remaining" />
            <button
              type="button"
              className="mine-face"
              aria-label="New game"
              onClick={() => reset()}
            >
              <Face status={status} pressing={pressing} />
            </button>
            <LedCounter value={elapsed} label="Seconds elapsed" />
          </div>

          <div
            className="mine-grid"
            role="grid"
            aria-label={`${label} minefield, ${rows} by ${cols}, ${mines} mines`}
            onContextMenu={(event) => event.preventDefault()}
          >
            {board.map((cell, index) => (
              <button
                key={index}
                type="button"
                role="gridcell"
                aria-label={
                  cell.revealed
                    ? cell.mine
                      ? "Mine"
                      : `${cell.adjacent || "No"} adjacent mines`
                    : cell.flagged
                      ? "Flagged"
                      : "Hidden"
                }
                className={cn(
                  "mine-cell",
                  cell.revealed && "is-revealed",
                  cell.revealed && !cell.mine && cell.adjacent > 0 && NUMBER_CLASSES[cell.adjacent],
                  cell.detonated && "is-detonated",
                  gameOver && cell.flagged && !cell.mine && "is-wrong-flag",
                )}
                onClick={() => handleCellActivate(index, cell)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  toggleFlag(index);
                }}
                onPointerDown={(event) => {
                  if (event.button === 0 && !cell.revealed && !gameOver) startLongPress(index, event.pointerType);
                }}
                onPointerUp={endLongPress}
                onPointerCancel={endLongPress}
                onPointerLeave={endLongPress}
              >
                {cell.revealed && cell.mine ? (
                  <MineGlyph />
                ) : cell.flagged ? (
                  gameOver && !cell.mine ? (
                    <span className="mine-wrong">✕</span>
                  ) : (
                    <FlagGlyph />
                  )
                ) : cell.revealed && cell.adjacent > 0 ? (
                  cell.adjacent
                ) : null}
              </button>
            ))}
          </div>

          <div className="mine-footer">
            <button
              type="button"
              className={cn("xp-control mine-flag-toggle", flagMode && "is-on")}
              aria-pressed={flagMode}
              onClick={() => setFlagMode((value) => !value)}
              title="Flag mode: taps plant flags (for touch screens)"
            >
              <FlagGlyph /> Flag mode
            </button>
            <span className="mine-hint">
              {status === "won"
                ? `Cleared in ${elapsed}s`
                : status === "lost"
                  ? "Boom. Press the face."
                  : `${rows * cols - mines - revealedCount} safe squares left`}
            </span>
          </div>
        </div>
      </div>

      {showBestTimes ? (
        <div className="mine-best" role="dialog" aria-label="Fastest Mine Sweepers">
          <strong>Fastest Mine Sweepers</strong>
          <table>
            <tbody>
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => (
                <tr key={key}>
                  <td>{DIFFICULTIES[key].label}</td>
                  <td>{bestTimes[key] !== undefined ? `${bestTimes[key]} seconds` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="xp-control primary" type="button" onClick={() => setShowBestTimes(false)}>
            OK
          </button>
        </div>
      ) : null}
    </div>
  );
}
