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
  if (!visible) return null;

  return (
    <div className="xp-balloon" role="status">
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
