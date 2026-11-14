import { Link } from "react-router";
import { RotateCcw, Star } from "lucide-react";
import Button from "../common/Button";
import Card from "../common/Card";
import CountUp from "../common/CountUp";
import SunMarker from "../dashboard/SunMarker";
import type { Badge as BadgeType } from "../../types";
import { badgeDescription, badgeIconKey, badgeTitle } from "../../utils/badgeCatalog";
import BadgeSeal from "../progress/BadgeSeal";

export interface LessonStats {
  correct: number;
  wrong: number;
  total: number;
  xpGained: number;
  // total XP akun setelah lesson ini (dari /lessons/{id}/complete)
  totalXp: number;
  badge: BadgeType | null;
}

interface LessonSummaryProps {
  stats: LessonStats;
  title: string;
  message: string;
  onFinish: () => void;
  // tombol kedua: link (misal ke Review) atau aksi (misal latihan lagi)
  secondary?: { label: string; to?: string; onClick?: () => void } | null;
}

const Tile = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1 rounded-2xl border-2 border-[var(--color-text)] bg-[var(--color-bg-card)] px-4 py-3">
    <span className="text-body-sm font-semibold text-[var(--color-text)]/75">{label}</span>
    <span className="font-heading text-3xl font-extrabold leading-none">{children}</span>
  </div>
);

const secondaryClass =
  "inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-[var(--color-text)] px-5 py-3 text-body-lg font-bold transition hover:bg-[var(--color-bg)]";

const LessonSummary = ({ stats, title, message, onFinish, secondary = null }: LessonSummaryProps) => {
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-8 sm:py-12">
      <Card className="relative flex flex-col items-center gap-5 overflow-hidden border-2 border-[var(--color-text)] p-6 text-center shadow-[8px_8px_0_var(--color-cta)] sm:p-10">
        <SunMarker size={112} fill={1} tone="card" />
        <div>
          <h1 className="font-heading text-[2.25rem] font-extrabold leading-none sm:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-[40ch] text-body-lg">{message}</p>
        </div>

        <div className="grid w-full grid-cols-3 gap-3 text-left">
          <Tile label={stats.xpGained < 0 ? "XP berkurang" : "XP didapat"}>
            {stats.xpGained < 0 ? "−" : "+"}
            <CountUp value={Math.abs(stats.xpGained)} />
          </Tile>
          <Tile label="Akurasi">
            <CountUp value={accuracy} />%
          </Tile>
          <Tile label="Benar">
            {stats.correct}
            <span className="text-body-lg font-semibold text-[var(--color-text)]/60">
              /{stats.total}
            </span>
          </Tile>
        </div>

        <p className="flex items-center gap-2 text-body-lg">
          <Star size={18} className="text-[var(--color-cta)]" aria-hidden="true" />
          Total XP kamu sekarang
          <span className="font-heading text-card-header font-extrabold">
            {stats.totalXp.toLocaleString("id-ID")}
          </span>
        </p>

        {stats.badge && (
          <div className="flex w-full items-center gap-4 rounded-2xl bg-[var(--color-text)] p-4 text-left text-[var(--color-bg-card)]">
            <BadgeSeal
              icon={badgeIconKey(stats.badge)}
              fill="var(--color-cta)"
              ink="var(--color-text)"
              iconSize={26}
              className="relative h-16 w-16"
            />
            <div className="min-w-0">
              <p className="text-body-sm font-semibold text-[var(--color-bg-card)]/80">
                Badge baru
              </p>
              <p className="font-heading text-card-header font-bold leading-tight">
                {badgeTitle(stats.badge)}
              </p>
              <p className="text-body-sm text-[var(--color-bg-card)]/80">
                {badgeDescription(stats.badge)}
              </p>
            </div>
          </div>
        )}

        <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
          <div className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">
            <Button onClick={onFinish} size="lg">
              Kembali ke lessons
            </Button>
          </div>
          {secondary?.to && (
            <Link to={secondary.to} className={secondaryClass}>
              <RotateCcw size={18} aria-hidden="true" />
              {secondary.label}
            </Link>
          )}
          {secondary?.onClick && !secondary.to && (
            <button type="button" onClick={secondary.onClick} className={secondaryClass}>
              <RotateCcw size={18} aria-hidden="true" />
              {secondary.label}
            </button>
          )}
        </div>
      </Card>
    </section>
  );
};

export default LessonSummary;
