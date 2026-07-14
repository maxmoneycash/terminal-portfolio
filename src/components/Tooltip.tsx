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
import { AnimatePresence, motion } from "framer-motion";
import { motionTransition } from "../lib/motion";

const SHOW_DELAY_MS = 850;
const INSTANT_WINDOW_MS = 650;
let instantUntil = 0;

export function Tooltip({ label, children }: { label: string; children: ReactElement<HTMLAttributes<HTMLElement>> }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const visibleRef = useRef(false);
  const [instant, setInstant] = useState(false);

  const show = (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const showInstantly = event.type === "focus" || performance.now() < instantUntil;
    setInstant(showInstantly);
    timerRef.current = window.setTimeout(() => {
      visibleRef.current = true;
      setAnchor(rect);
    }, showInstantly ? 0 : SHOW_DELAY_MS);
  };

  const hide = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (visibleRef.current) instantUntil = performance.now() + INSTANT_WINDOW_MS;
    visibleRef.current = false;
    setAnchor(null);
  };

  useEffect(() => hide, []);

  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const rect = tip.getBoundingClientRect();
    let top = anchor.bottom + 5;
    const placedAbove = top + rect.height > window.innerHeight - 4;
    if (placedAbove) top = anchor.top - rect.height - 5;
    const left = Math.max(4, Math.min(anchor.left + anchor.width / 2 - rect.width / 2, window.innerWidth - rect.width - 4));
    setStyle({ top, left, transformOrigin: placedAbove ? "bottom center" : "top center" });
  }, [anchor]);

  return (
    <>
      {cloneElement(children, { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide })}
      {createPortal(
        <AnimatePresence>
          {anchor ? (
            <motion.span
              ref={tipRef}
              className="xp-tooltip"
              data-instant={instant || undefined}
              role="tooltip"
              style={style ?? { top: -9999, left: -9999 }}
              initial={{ opacity: 0, transform: "translate3d(0, 2px, 0) scale(0.985)" }}
              animate={{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }}
              exit={{ opacity: 0, transform: "translate3d(0, 1px, 0) scale(0.99)" }}
              transition={instant ? { duration: 0 } : motionTransition.micro}
            >
              {label}
            </motion.span>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
