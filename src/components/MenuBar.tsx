import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../lib/cn";
import { motionTransition, press } from "../lib/motion";

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
          <motion.button
            type="button"
            className={cn(openIndex === index && "is-open")}
            aria-haspopup="menu"
            aria-expanded={openIndex === index}
            onClick={() => setOpenIndex((current) => (current === index ? null : index))}
            onMouseEnter={() => setOpenIndex((current) => (current === null ? current : index))}
            whileTap={press}
            transition={motionTransition.micro}
          >
            {menu.label}
          </motion.button>
          <AnimatePresence>
          {openIndex === index ? (
            <motion.div
              className="menu-dropdown"
              role="menu"
              initial={{ opacity: 0, transform: "translate3d(0, -3px, 0) scale(0.985)" }}
              animate={{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }}
              exit={{ opacity: 0, transform: "translate3d(0, -2px, 0) scale(0.99)" }}
              transition={motionTransition.micro}
            >
              {menu.items.map((item, itemIndex) =>
                item === "separator" ? (
                  <div className="menu-separator" key={`separator-${itemIndex}`} role="separator" />
                ) : item.href ? (
                  <motion.a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    onClick={() => setOpenIndex(null)}
                    whileTap={press}
                  >
                    {item.label}
                  </motion.a>
                ) : (
                  <motion.button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpenIndex(null);
                      item.onSelect?.();
                    }}
                    whileTap={press}
                  >
                    {item.checked ? (
                      <span className="menu-check" aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                    {item.label}
                  </motion.button>
                ),
              )}
            </motion.div>
          ) : null}
          </AnimatePresence>
        </span>
      ))}
    </nav>
  );
}
