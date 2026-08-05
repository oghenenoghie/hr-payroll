"use client";

import { Children } from "react";
import { motion, type Variants } from "motion/react";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

/** Wraps server-rendered widget cards with a staggered entrance and a
 * hover cue, without touching each widget's own markup — every widget
 * already renders its own bordered card, this only adds the `group` that
 * their `group-hover:border-primary` reacts to. */
export function AnimatedWidgetGrid({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="grid grid-cols-1 gap-5 sm:grid-cols-2"
    >
      {Children.map(children, (child) => (
        <motion.div variants={item} className="group">
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
