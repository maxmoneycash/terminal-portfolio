/**
 * Recycle Bin — a details-view list of decisions this site actually deleted.
 * Emptying plays the XP recycle cue and swaps the desktop icon to the empty
 * bin for the rest of the session.
 */
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { playSfx } from "../xp/audio";
import {
  isRecycleBinEmpty,
  recycledItems,
  setRecycleBinEmpty,
  subscribeRecycleBin,
} from "../data/recycle";

function TrashDocGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 1h9l3 3v15H4z"
        fill="#fff"
        stroke="#8c8c8c"
        strokeWidth="0.8"
      />
      <path d="M13 1v3h3z" fill="#d8d8d8" />
      {[6, 9, 12, 15].map((y) => (
        <rect key={y} x="6" y={y} width={y === 15 ? 5 : 8} height="1.2" fill="#7c90ac" />
      ))}
    </svg>
  );
}

export function RecycleBinApp() {
  const [empty, setEmpty] = useState(isRecycleBinEmpty);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => subscribeRecycleBin(setEmpty), []);

  const selectedItem = recycledItems.find((item) => item.name === selected) ?? null;

  const emptyBin = () => {
    playSfx("recycle");
    setRecycleBinEmpty(true);
    setSelected(null);
  };

  return (
    <div className="recycle-app">
      <div className="recycle-toolbar">
        <button className="xp-control" type="button" onClick={emptyBin} disabled={empty}>
          Empty Recycle Bin
        </button>
        <button
          className="xp-control"
          type="button"
          disabled={!empty}
          onClick={() => setRecycleBinEmpty(false)}
        >
          Put everything back
        </button>
        <span className="recycle-count" role="status">
          {empty ? "0 objects" : `${recycledItems.length} objects`}
        </span>
      </div>

      {empty ? (
        <div className="recycle-empty-state">
          <img src="/xp/gui/desktop/recycle-empty.png" width="48" height="48" alt="" />
          <strong>The Recycle Bin is empty.</strong>
          <p>Every deletion in here was a real decision — put them back to read the history.</p>
        </div>
      ) : (
        <>
          <div className="recycle-list" role="listbox" aria-label="Deleted items">
            <div className="recycle-row recycle-head" aria-hidden="true">
              <span>Name</span>
              <span>Original Location</span>
              <span>Date Deleted</span>
            </div>
            {recycledItems.map((item) => (
              <button
                key={item.name}
                type="button"
                role="option"
                aria-selected={selected === item.name}
                className={cn("recycle-row", selected === item.name && "is-selected")}
                onClick={() => setSelected(item.name)}
              >
                <span className="recycle-name">
                  <TrashDocGlyph />
                  {item.name}
                </span>
                <span>{item.origin}</span>
                <span>{item.deletedOn}</span>
              </button>
            ))}
          </div>

          <div className="recycle-details" aria-live="polite">
            {selectedItem ? (
              <>
                <strong>{selectedItem.name}</strong>
                <p>{selectedItem.note}</p>
              </>
            ) : (
              <p>Select an item to see why it was deleted. Restore is not offered — these earned it.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
