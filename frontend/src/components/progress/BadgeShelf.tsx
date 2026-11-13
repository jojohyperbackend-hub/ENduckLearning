import { Award, Flame, Star } from "lucide-react";
import type { Badge } from "../../types";
import { badgeHint, badgeLabel, formatDate } from "../../utils/formatters";

const BadgeIcon = ({ type }: { type: string }) => {
  if (type === "current_streak") return <Flame size={26} aria-hidden="true" />;
  if (type === "total_xp") return <Star size={26} aria-hidden="true" />;
  return <Award size={26} aria-hidden="true" />;
};

const BadgeShelf = ({ badges }: { badges: Badge[] }) => {
  if (badges.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[var(--color-text)]/40 p-6">
        <p className="font-heading text-card-header font-bold">Belum ada badge</p>
        <p className="mt-1 max-w-[52ch] text-body-lg">
          Badge muncul otomatis saat XP atau streak kamu menyentuh target tertentu. Selesaikan satu
          lesson lagi, siapa tahu itu yang membukanya.
        </p>
      </div>
    );
  }

  const sorted = [...badges].sort(
    (a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime(),
  );

  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((badge) => (
        <li
          key={badge.badge_id}
          className="flex items-center gap-4 rounded-2xl border-2 border-[var(--color-text)] bg-[var(--color-bg-card)] p-4"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--color-text)] text-[var(--color-bg-card)]">
            <BadgeIcon type={badge.criteria_type} />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-card-header font-bold leading-tight">
              {badgeLabel(badge.criteria_type, badge.criteria_value)}
            </p>
            <p className="text-body-sm text-[var(--color-text)]/80">
              {badgeHint(badge.criteria_type, badge.criteria_value)}
            </p>
            <p className="mt-0.5 text-body-sm text-[var(--color-text)]/60">
              Didapat {formatDate(badge.earned_at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default BadgeShelf;
