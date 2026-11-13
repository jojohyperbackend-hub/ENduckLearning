import { Heart } from "lucide-react";
import { formatCountdown } from "../../hooks/useHeartClock";

const MAX_HEARTS = 5;

interface HeartsMeterProps {
  hearts: number;
  // detik sampai heart berikutnya balik
  nextIn?: number | null;
}

const HeartsMeter = ({ hearts, nextIn = null }: HeartsMeterProps) => {
  const safe = Math.min(Math.max(hearts, 0), MAX_HEARTS);
  return (
    <div className="flex shrink-0 flex-col items-end">
      <div
        role="img"
        aria-label={`${safe} dari ${MAX_HEARTS} heart tersisa`}
        className="flex items-center gap-0.5"
      >
        {Array.from({ length: MAX_HEARTS }, (_, index) => (
          <Heart
            key={index}
            size={18}
            aria-hidden="true"
            className={`transition-colors duration-300 ${
              index < safe
                ? "fill-[var(--color-cta)] text-[var(--color-cta)]"
                : "text-[var(--color-text)]/25"
            }`}
          />
        ))}
      </div>
      {nextIn !== null && safe < MAX_HEARTS && (
        <span className="text-body-sm font-semibold tabular-nums text-[var(--color-text)]/70">
          +1 dalam {formatCountdown(nextIn)}
        </span>
      )}
    </div>
  );
};

export default HeartsMeter;
