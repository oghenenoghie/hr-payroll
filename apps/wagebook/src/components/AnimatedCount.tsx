"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/** Counts up to `value` on mount/change. Renders the final number
 * immediately for prefers-reduced-motion and for non-JS/first paint. */
export function AnimatedCount({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reduceMotion) {
      node.textContent = value.toLocaleString("en-NG");
      return;
    }

    const controls = animate(0, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (latest) => {
        node.textContent = Math.round(latest).toLocaleString("en-NG");
      },
    });

    return () => controls.stop();
  }, [value, reduceMotion]);

  return <span ref={ref}>{value.toLocaleString("en-NG")}</span>;
}
