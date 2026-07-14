import type { Transition, Variants } from "framer-motion";

export const easeOut = [0.16, 1, 0.3, 1] as const;
export const easeInOut = [0.65, 0, 0.35, 1] as const;

export const motionTransition = {
  micro: { duration: 0.12, ease: easeOut },
  short: { duration: 0.22, ease: easeOut },
  panel: { duration: 0.3, ease: easeOut },
  page: { duration: 0.42, ease: easeOut },
  exit: { duration: 0.18, ease: easeOut },
  spatial: { type: "spring", stiffness: 400, damping: 40, mass: 0.8 },
  drag: { type: "spring", stiffness: 280, damping: 26, mass: 0.85 },
} satisfies Record<string, Transition>;

export const press = {
  transform: "translate3d(0, 1px, 0) scale(0.98)",
};

export const fadeThrough: Variants = {
  hidden: { opacity: 0, transform: "translate3d(0, 2px, 0) scale(0.995)" },
  visible: { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", transition: motionTransition.short },
  exit: { opacity: 0, transform: "translate3d(0, -1px, 0) scale(0.998)", transition: motionTransition.exit },
};

export const rise: Variants = {
  hidden: { opacity: 0, transform: "translate3d(0, 10px, 0) scale(1)" },
  visible: { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", transition: motionTransition.page },
  exit: { opacity: 0, transform: "translate3d(0, 5px, 0) scale(1)", transition: motionTransition.exit },
};

export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
  exit: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, transform: "translate3d(0, 8px, 0) scale(1)" },
  visible: { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", transition: motionTransition.panel },
  exit: { opacity: 0, transform: "translate3d(0, 4px, 0) scale(1)", transition: motionTransition.exit },
};

export const quickStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.018, delayChildren: 0.015 } },
  exit: { transition: { staggerChildren: 0.01, staggerDirection: -1 } },
};

export const quickItem: Variants = {
  hidden: { opacity: 0, transform: "translate3d(0, 3px, 0) scale(1)" },
  visible: { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", transition: motionTransition.micro },
  exit: { opacity: 0, transform: "translate3d(0, 1px, 0) scale(1)", transition: motionTransition.micro },
};

export const sheet: Variants = {
  hidden: { opacity: 0, transform: "translate3d(0, 24px, 0) scale(0.985)" },
  visible: { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", transition: motionTransition.spatial },
  exit: { opacity: 0, transform: "translate3d(0, 16px, 0) scale(0.99)", transition: motionTransition.exit },
};
