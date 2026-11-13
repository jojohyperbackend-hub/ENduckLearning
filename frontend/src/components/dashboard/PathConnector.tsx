import { curveBetween, type PathOrientation, type Point } from "./pathLayout";

interface PathConnectorProps {
  width: number;
  height: number;
  points: Point[];
  sun: Point;
  // jumlah lesson yang sudah selesai: segmen sebelum ini digambar terang
  doneCount: number;
  orientation: PathOrientation;
}

// Jejak langkah putus-putus yang nyambungin tiap batu pijakan sampai matahari.
const PathConnector = ({
  width,
  height,
  points,
  sun,
  doneCount,
  orientation,
}: PathConnectorProps) => {
  const stops = [...points, sun];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    >
      {stops.slice(0, -1).map((from, index) => {
        const walked = index < doneCount;
        return (
          <path
            key={index}
            d={curveBetween(from, stops[index + 1], orientation)}
            fill="none"
            stroke="#fbe8d3"
            strokeOpacity={walked ? 1 : 0.35}
            strokeWidth={walked ? 5 : 4}
            strokeLinecap="round"
            strokeDasharray="1 13"
          />
        );
      })}
    </svg>
  );
};

export default PathConnector;
