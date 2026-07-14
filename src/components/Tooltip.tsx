import {
  cloneElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type HTMLAttributes,
  type MouseEvent,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";

const SHOW_DELAY_MS = 400;

export function Tooltip({ label, children }: { label: string; children: ReactElement<HTMLAttributes<HTMLElement>> }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const show = (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    timerRef.current = window.setTimeout(() => setAnchor(rect), SHOW_DELAY_MS);
  };

  const hide = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setAnchor(null);
    setStyle(null);
  };

  useEffect(() => hide, []);

  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const rect = tip.getBoundingClientRect();
    let top = anchor.bottom + 5;
    if (top + rect.height > window.innerHeight - 4) top = anchor.top - rect.height - 5;
    const left = Math.max(4, Math.min(anchor.left + anchor.width / 2 - rect.width / 2, window.innerWidth - rect.width - 4));
    setStyle({ top, left });
  }, [anchor]);

  return (
    <>
      {cloneElement(children, { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide })}
      {anchor
        ? createPortal(
            <span ref={tipRef} className="xp-tooltip" role="tooltip" style={style ?? { top: -9999, left: -9999 }}>
              {label}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
