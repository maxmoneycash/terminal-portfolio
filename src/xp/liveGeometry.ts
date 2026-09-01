/**
 * Live window geometry: pointer-driven move/resize written straight to the
 * DOM and committed to React once, so a drag never re-renders the desktop.
 */
export type LiveBox = { x: number; y: number; width: number; height: number };

export type LiveDragSession = {
  mode: "move" | "resize";
  edge?: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  clamp: (box: LiveBox) => LiveBox;
};

export function computeLiveBox(session: LiveDragSession, clientX: number, clientY: number): LiveBox {
  const dx = clientX - session.startX;
  const dy = clientY - session.startY;
  if (session.mode === "move") {
    return session.clamp({
      x: session.originX + dx,
      y: session.originY + dy,
      width: session.width,
      height: session.height,
    });
  }

  const edge = session.edge ?? "se";
  let x = session.originX;
  let y = session.originY;
  let width = session.width;
  let height = session.height;
  if (edge.includes("e")) width = session.width + dx;
  if (edge.includes("s")) height = session.height + dy;
  if (edge.includes("w")) {
    width = session.width - dx;
    x = session.originX + dx;
  }
  if (edge.includes("n")) {
    height = session.height - dy;
    y = session.originY + dy;
  }
  if (width < session.minWidth) {
    if (edge.includes("w")) x -= session.minWidth - width;
    width = session.minWidth;
  }
  if (height < session.minHeight) {
    if (edge.includes("n")) y -= session.minHeight - height;
    height = session.minHeight;
  }
  return session.clamp({ x, y, width, height });
}

export function paintLiveBox(element: HTMLElement, box: LiveBox, mode: LiveDragSession["mode"]) {
  element.style.left = `${box.x}px`;
  element.style.top = `${box.y}px`;
  if (mode === "resize") {
    element.style.width = `${box.width}px`;
    element.style.height = `${box.height}px`;
  }
}

/** Drive a drag/resize at display refresh. Returns a disposer. */
export function attachLiveDrag({
  element,
  session,
  onCommit,
}: {
  element: HTMLElement;
  session: LiveDragSession;
  onCommit: (box: LiveBox) => void;
}) {
  let latest: PointerEvent | null = null;
  let raf = 0;
  let done = false;
  let box: LiveBox = {
    x: session.originX,
    y: session.originY,
    width: session.width,
    height: session.height,
  };

  element.classList.add("is-dragging");

  const flush = () => {
    raf = 0;
    if (!latest) return;
    box = computeLiveBox(session, latest.clientX, latest.clientY);
    paintLiveBox(element, box, session.mode);
  };

  const onMove = (event: PointerEvent) => {
    latest = event;
    if (!raf) raf = window.requestAnimationFrame(flush);
  };

  const finish = () => {
    if (done) return;
    done = true;
    if (raf) {
      window.cancelAnimationFrame(raf);
      flush();
    } else if (latest) {
      flush();
    }
    element.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    onCommit(box);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);

  return () => {
    if (done) return;
    done = true;
    if (raf) window.cancelAnimationFrame(raf);
    element.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
  };
}
