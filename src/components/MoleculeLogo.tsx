/** Stick-diagram molecule logo (caffeine-inspired hexagon + bonds). */
export function MoleculeLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Hexagonal ring (benzene-style) */}
      <polygon points="24,10 35,16 35,28 24,34 13,28 13,16" />
      {/* Inner double-bond hint */}
      <polygon
        points="24,13 32,17.5 32,26.5 24,31 16,26.5 16,17.5"
        opacity="0.45"
      />
      {/* Bonds out to substituent atoms */}
      <line x1="35" y1="16" x2="42" y2="12" />
      <line x1="35" y1="28" x2="42" y2="32" />
      <line x1="13" y1="16" x2="6" y2="12" />
      <line x1="13" y1="28" x2="6" y2="32" />
      <line x1="24" y1="34" x2="24" y2="42" />
      {/* Atom nodes */}
      <circle cx="42" cy="12" r="2.2" fill="currentColor" />
      <circle cx="42" cy="32" r="2.2" fill="currentColor" />
      <circle cx="6" cy="12" r="2.2" fill="currentColor" />
      <circle cx="6" cy="32" r="2.2" fill="currentColor" />
      <circle cx="24" cy="42" r="2.2" fill="currentColor" />
    </svg>
  );
}