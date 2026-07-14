import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { motionTransition, press, sheet } from "../lib/motion";

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
    <AnimatePresence>
    {visible ? (
    <motion.div
      className="xp-balloon"
      role="status"
      variants={sheet}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <header>
        <img src="/xp/gui/taskbar/welcome.webp" alt="" />
        <strong>{title}</strong>
        <motion.button
          type="button"
          aria-label="Close notification"
          onClick={onClose}
          whileTap={press}
          transition={motionTransition.micro}
        >
          ×
        </motion.button>
      </header>
      <p>{children}</p>
    </motion.div>
    ) : null}
    </AnimatePresence>
  );
}
