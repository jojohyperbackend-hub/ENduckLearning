import type { Point } from "./pathLayout";

interface SunriseBackgroundProps {
  width: number;
  height: number;
  sun: Point;
}

// Posisi bintang dalam persen panel, sengaja gak rata biar kerasa digambar tangan.
const STARS = [
  { x: 6, y: 62, r: 2 },
  { x: 14, y: 40, r: 1.5 },
  { x: 24, y: 78, r: 1.5 },
  { x: 33, y: 52, r: 2.5 },
  { x: 41, y: 22, r: 1.5 },
  { x: 52, y: 70, r: 2 },
  { x: 58, y: 36, r: 1.5 },
  { x: 71, y: 86, r: 2 },
  { x: 88, y: 66, r: 1.5 },
];

// Langit malam flat (Ocean Ink) dengan dua lingkar cahaya solid di sekitar
// matahari. Tanpa gradasi: tiap lapis satu warna rata.
const SunriseBackground = ({ width, height, sun }: SunriseBackgroundProps) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    >
      <circle cx={sun.x} cy={sun.y} r={190} fill="#2e4470" />
      <circle cx={sun.x} cy={sun.y} r={112} fill="#35507f" />
      {STARS.map((star, index) => (
        <circle
          key={index}
          cx={(star.x / 100) * width}
          cy={(star.y / 100) * height}
          r={star.r}
          fill="#fbe8d3"
          fillOpacity="0.55"
        />
      ))}
    </svg>
  );
};

export default SunriseBackground;
