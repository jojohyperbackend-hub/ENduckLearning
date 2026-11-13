import { useId } from "react";

interface SunMarkerProps {
  size?: number;
  // 0..1: seberapa penuh matahari keisi (progres unit). 1 = terbit penuh.
  fill?: number;
  tone?: "sky" | "card";
  className?: string;
}

const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);
const RADIUS = 24;

// Matahari flat: garis luar + isi pink yang naik dari bawah seiring progres.
const SunMarker = ({ size = 72, fill = 0, tone = "sky", className = "" }: SunMarkerProps) => {
  const clipId = useId();
  const level = Math.min(Math.max(fill, 0), 1);
  const isRisen = level >= 1;
  const outline = tone === "sky" ? "#fbe8d3" : "#283c63";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r={RADIUS} />
        </clipPath>
      </defs>

      <g className={isRisen ? "sun-rays-spin" : undefined} style={{ transformOrigin: "50px 50px" }}>
        {RAYS.map((angle) => (
          <line
            key={angle}
            x1="50"
            y1="6"
            x2="50"
            y2={angle % 60 === 0 ? 17 : 13}
            stroke={outline}
            strokeOpacity={isRisen ? 1 : 0.5}
            strokeWidth="4.5"
            strokeLinecap="round"
            transform={`rotate(${angle} 50 50)`}
          />
        ))}
      </g>

      <g clipPath={`url(#${clipId})`}>
        <rect
          x={50 - RADIUS}
          y={50 - RADIUS}
          width={RADIUS * 2}
          height={RADIUS * 2}
          fill="#f85f73"
          className="sun-fill"
          style={{ transform: `translateY(${(1 - level) * RADIUS * 2}px)` }}
        />
      </g>
      <circle cx="50" cy="50" r={RADIUS} fill="none" stroke={outline} strokeWidth="4.5" />
    </svg>
  );
};

export default SunMarker;
