import type { ReactNode } from "react";

export function TrayBalloon({
  title,
  children,
  visible,
  onClose,
}: {
  title: string;
  children: ReactNode;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="xp-balloon"
      data-state={visible ? "visible" : "hidden"}
      role={visible ? "status" : undefined}
      aria-hidden={!visible}
      inert={!visible}
    >
      <header>
        <img src="/xp/gui/taskbar/welcome.webp" alt="" />
        <strong>{title}</strong>
        <button type="button" aria-label="Close notification" onClick={onClose}>
          ×
        </button>
      </header>
      <p>{children}</p>
    </div>
  );
}
