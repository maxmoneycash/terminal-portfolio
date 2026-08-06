import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { playSfx } from "../xp/audio";

export type WindowMenuItem =
  | {
      label: string;
      onSelect?: () => void;
      href?: string;
      checked?: boolean;
      disabled?: boolean;
    }
  | "separator";

export type WindowMenu = {
  label: string;
  items: WindowMenuItem[];
};

export function MenuBar({ menus, ariaLabel }: { menus: WindowMenu[]; ariaLabel: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (openIndex === null) return;

    const handlePointerDown = (event: Event) => {
      if (navRef.current?.contains(event.target as Node)) return;
      setOpenIndex(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openIndex]);

  return (
    <nav className="window-menu" aria-label={ariaLabel} ref={navRef}>
      {menus.map((menu, index) => (
        <span className="menu-root" key={menu.label}>
          <button
            type="button"
            className={cn(openIndex === index && "is-open")}
            aria-haspopup="menu"
            aria-expanded={openIndex === index}
            onClick={() => setOpenIndex((current) => (current === index ? null : index))}
            onMouseEnter={() => setOpenIndex((current) => (current === null ? current : index))}
          >
            {menu.label}
          </button>
          {openIndex === index ? (
            <div className="menu-dropdown" role="menu">
              {menu.items.map((item, itemIndex) =>
                item === "separator" ? (
                  <div className="menu-separator" key={`separator-${itemIndex}`} role="separator" />
                ) : item.href ? (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    onClick={() => setOpenIndex(null)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    aria-disabled={item.disabled || undefined}
                    onPointerDown={(event) => {
                      // Keep unavailable commands focusable so the reason is
                      // discoverable; XP dings instead of silently ignoring.
                      if (!item.disabled) return;
                      event.preventDefault();
                      playSfx("exclamation");
                    }}
                    onClick={() => {
                      if (item.disabled) return;
                      setOpenIndex(null);
                      item.onSelect?.();
                    }}
                  >
                    {item.checked ? (
                      <span className="menu-check" aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                    {item.label}
                  </button>
                ),
              )}
            </div>
          ) : null}
        </span>
      ))}
    </nav>
  );
}
