/** A scroll viewport that shades whichever edges have more content past them. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";

type EdgeState = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

export function ScrollPane({ children, className }: { children: ReactNode; className?: string }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState<EdgeState>({ top: false, right: false, bottom: false, left: false });

  const updateEdges = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const epsilon = 2;
    const next = {
      top: viewport.scrollTop > epsilon,
      right: viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - epsilon,
      bottom: viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - epsilon,
      left: viewport.scrollLeft > epsilon,
    };
    setEdges((current) =>
      current.top === next.top &&
      current.right === next.right &&
      current.bottom === next.bottom &&
      current.left === next.left
        ? current
        : next,
    );
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateEdges();
    viewport.addEventListener("scroll", updateEdges, { passive: true });
    const resizeObserver = new ResizeObserver(updateEdges);
    resizeObserver.observe(viewport);
    if (viewport.firstElementChild) resizeObserver.observe(viewport.firstElementChild);

    return () => {
      viewport.removeEventListener("scroll", updateEdges);
      resizeObserver.disconnect();
    };
  }, [updateEdges, children]);

  return (
    <div
      className={cn(
        "scroll-surface",
        edges.top && "has-top-edge",
        edges.right && "has-right-edge",
        edges.bottom && "has-bottom-edge",
        edges.left && "has-left-edge",
        className,
      )}
    >
      <div className="scroll-viewport" ref={viewportRef} tabIndex={0}>
        <div className="scroll-content">{children}</div>
      </div>
      <div className="scroll-edge scroll-edge-top" aria-hidden="true" />
      <div className="scroll-edge scroll-edge-right" aria-hidden="true" />
      <div className="scroll-edge scroll-edge-bottom" aria-hidden="true" />
      <div className="scroll-edge scroll-edge-left" aria-hidden="true" />
    </div>
  );
}
