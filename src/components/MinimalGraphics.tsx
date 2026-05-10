import { motion } from "framer-motion";

/** Decorative EKG / pulse line — minimal SVG, theme-aware. */
export function PulseLine({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 600 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <motion.path
        d="M0 40 L120 40 L140 40 L160 18 L180 62 L200 28 L215 52 L235 40 L360 40 L380 40 L400 22 L420 58 L440 40 L600 40"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2.4, ease: "easeInOut" }}
      />
    </svg>
  );
}

/** Decorative molecule / network of nodes & edges. */
export function MoleculeMark({ className = "" }: { className?: string }) {
  const nodes = [
    { cx: 30, cy: 60 },
    { cx: 70, cy: 30 },
    { cx: 110, cy: 60 },
    { cx: 90, cy: 100 },
    { cx: 40, cy: 110 },
    { cx: 140, cy: 100 },
  ];
  const edges: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [2, 5], [3, 5],
  ];
  return (
    <svg className={className} viewBox="0 0 170 140" fill="none" aria-hidden>
      {edges.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={nodes[a].cx} y1={nodes[a].cy}
          x2={nodes[b].cx} y2={nodes[b].cy}
          stroke="currentColor"
          strokeWidth="0.8"
          opacity={0.35}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, delay: 0.1 + i * 0.08, ease: "easeOut" }}
        />
      ))}
      {nodes.map((n, i) => (
        <motion.circle
          key={i}
          cx={n.cx} cy={n.cy} r={3.2}
          fill="currentColor"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 + i * 0.06 }}
        />
      ))}
    </svg>
  );
}

/** Minimalist concentric rings — used as ambient backdrop. */
export function ConcentricRings({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 300 300" fill="none" aria-hidden>
      {[40, 70, 105, 140].map((r, i) => (
        <circle
          key={r}
          cx="150" cy="150" r={r}
          stroke="currentColor"
          strokeWidth="0.6"
          opacity={0.18 - i * 0.03}
        />
      ))}
      <circle cx="150" cy="150" r="3" fill="currentColor" opacity="0.5" />
    </svg>
  );
}