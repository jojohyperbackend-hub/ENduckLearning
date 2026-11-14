import { Crown, Flame, HeartCrack, Medal, Star, Target } from "lucide-react";
import type { BadgeIconKey } from "../../utils/badgeCatalog";

const ICONS = {
  crown: Crown,
  medal: Medal,
  target: Target,
  "heart-crack": HeartCrack,
  flame: Flame,
  star: Star,
} as const;

// Pinggiran stempel bergerigi: titik-titik di lingkaran disambung busur kecil ke luar.
const SEAL_PATH = (() => {
  const bumps = 16;
  const center = 50;
  const radius = 40;
  const chord = 2 * radius * Math.sin(Math.PI / bumps);
  const arc = (chord / 2) * 1.08;
  let path = "";
  for (let index = 0; index <= bumps; index += 1) {
    const angle = (2 * Math.PI * index) / bumps - Math.PI / 2;
    const x = (center + radius * Math.cos(angle)).toFixed(2);
    const y = (center + radius * Math.sin(angle)).toFixed(2);
    path += index === 0 ? `M${x} ${y}` : ` A${arc.toFixed(2)} ${arc.toFixed(2)} 0 0 1 ${x} ${y}`;
  }
  return `${path} Z`;
})();

export const BadgeGlyph = ({ icon, size }: { icon: BadgeIconKey; size: number }) => {
  const Icon = ICONS[icon];
  return <Icon size={size} strokeWidth={2.25} aria-hidden="true" />;
};

type BadgeSealProps = {
  icon: BadgeIconKey;
  locked?: boolean;
  /** Warna isi stempel (CSS color). */
  fill?: string;
  /** Warna ikon di dalam stempel (CSS color). */
  ink?: string;
  className?: string;
  iconSize?: number;
};

const BadgeSeal = ({
  icon,
  locked = false,
  fill = "var(--color-cta)",
  ink = "var(--color-text)",
  className = "",
  iconSize = 28,
}: BadgeSealProps) => (
  <span className={`grid shrink-0 place-items-center ${className}`}>
    <svg viewBox="-4 -4 108 108" className="absolute inset-0 h-full w-full" aria-hidden="true">
      {locked ? (
        <path
          d={SEAL_PATH}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={2}
          strokeDasharray="5 4"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <>
          <path d={SEAL_PATH} fill={fill} />
          <circle cx="50" cy="50" r="29" fill="none" stroke={ink} strokeOpacity={0.35} strokeWidth={2} />
        </>
      )}
    </svg>
    <span
      className="relative"
      style={{ color: locked ? undefined : ink, opacity: locked ? 0.4 : 1 }}
    >
      <BadgeGlyph icon={icon} size={iconSize} />
    </span>
  </span>
);

export default BadgeSeal;
