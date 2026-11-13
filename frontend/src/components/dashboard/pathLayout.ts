// Hitung posisi batu pijakan Sunrise Path.
// Desktop: naik diagonal dari kiri-bawah ke matahari di kanan-atas.
// Mobile: naik lurus ke atas sambil zig-zag, matahari di puncak.

export type PathOrientation = "diagonal" | "vertical";

export interface Point {
  x: number;
  y: number;
}

export interface PathLayout {
  height: number;
  tile: number;
  step: number; // jarak horizontal antar node (buat nentuin label panjang/pendek)
  points: Point[];
  sun: Point;
}

const DIAGONAL = { padLeft: 28, sunSpace: 132, top: 150, bottom: 118 };
const VERTICAL = { gap: 104, top: 168, bottom: 64 };

export const getPathHeight = (
  count: number,
  orientation: PathOrientation,
): number => {
  const steps = Math.max(count - 1, 0);
  if (orientation === "vertical") {
    return VERTICAL.top + steps * VERTICAL.gap + VERTICAL.bottom;
  }
  return DIAGONAL.top + steps * getRise(count) + DIAGONAL.bottom;
};

const getRise = (count: number) => (count <= 5 ? 38 : count <= 8 ? 28 : 22);

export const layoutPath = (
  count: number,
  width: number,
  orientation: PathOrientation,
): PathLayout => {
  const height = getPathHeight(count, orientation);

  if (orientation === "vertical") {
    const swing = Math.min(width * 0.2, 84);
    const points = Array.from({ length: count }, (_, i) => ({
      x: width / 2 + (i % 2 === 0 ? -swing : swing),
      y: height - VERTICAL.bottom - i * VERTICAL.gap,
    }));
    return {
      height,
      tile: 64,
      step: width,
      points,
      sun: { x: width / 2, y: 74 },
    };
  }

  const usable = width - DIAGONAL.padLeft - DIAGONAL.sunSpace;
  const step = usable / Math.max(count, 1);
  const rise = getRise(count);
  const points = Array.from({ length: count }, (_, i) => ({
    x: DIAGONAL.padLeft + step * (i + 0.5),
    // goyang dikit biar kerasa jejak kaki, bukan tangga lurus
    y: height - DIAGONAL.bottom - i * rise + (i % 2 === 0 ? 6 : -6),
  }));
  return {
    height,
    tile: step >= 84 ? 64 : 54,
    step,
    points,
    sun: { x: width - 78, y: 82 },
  };
};

// Lengkungan S antar dua titik, arahnya ngikutin orientasi jalur.
export const curveBetween = (
  from: Point,
  to: Point,
  orientation: PathOrientation,
): string => {
  if (orientation === "vertical") {
    const midY = (from.y + to.y) / 2;
    return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
  }
  const midX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
};
