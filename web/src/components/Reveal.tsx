import type { ReactNode } from "react";
import { useReveal } from "../lib/motion";

/** Scroll-reveal wrapper. `stagger` animates each direct child in sequence. */
export function Reveal({ children, stagger = false, className = "", as: Tag = "div" }: { children: ReactNode; stagger?: boolean; className?: string; as?: "div" | "section" | "ul" }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={`${stagger ? "reveal-stagger" : "reveal"} ${className}`}>
      {children}
    </Tag>
  );
}

export function Skeleton({ w = "100%", h = 14, style = {} }: { w?: number | string; h?: number; style?: React.CSSProperties }) {
  return <span className="skeleton" style={{ display: "block", width: w, height: h, ...style }} />;
}
