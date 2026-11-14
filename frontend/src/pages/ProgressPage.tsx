import { useEffect } from "react";
import { useLocation } from "react-router";
import { Flame, Heart } from "lucide-react";
import BadgeShelf from "../components/progress/BadgeShelf";
import { badgeCollection } from "../utils/badgeCatalog";
import ProgressSegments from "../components/progress/ProgressSegments";
import ReviewSection from "../components/progress/ReviewSection";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import CountUp from "../components/common/CountUp";
import { useProgressPage, type ProgressPageData } from "../hooks/useProgressPage";
import { formatCountdown, toHeartSnapshot, useHeartClock } from "../hooks/useHeartClock";
import type { AttemptResult } from "../types";

const MAX_HEARTS = 5;

const SectionHeading = ({
  id,
  title,
  aside,
}: {
  id?: string;
  title: string;
  aside?: string;
}) => (
  <div id={id} className="flex flex-wrap items-baseline justify-between gap-2 scroll-mt-6">
    <h2 className="font-heading text-4xl font-extrabold leading-none">{title}</h2>
    {aside && <p className="text-body-lg">{aside}</p>}
  </div>
);

const ProgressContent = ({
  data,
  onAttempt,
  onResolved,
}: {
  data: ProgressPageData;
  onAttempt: (result: AttemptResult) => void;
  onResolved: (reviewId: string) => void;
}) => {
  const { progress, units, reviewItems, courseTitle } = data;
  const clock = useHeartClock(data.hearts);
  const hearts = Math.min(Math.max(clock.hearts, 0), MAX_HEARTS);

  const totalLessons = units?.reduce((sum, unit) => sum + unit.lessons.length, 0) ?? 0;
  const doneLessons =
    units?.reduce((sum, unit) => sum + unit.lessons.filter((l) => l.completed).length, 0) ?? 0;
  const reviewCount = reviewItems?.length ?? null;
  const badgeStats = badgeCollection(progress.badges);

  // Dari halaman lain (/progress#review): geser ke bagian Review setelah data muncul.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash !== "#review") return;
    document.getElementById("review")?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <section className="flex flex-col gap-10 py-8 sm:py-10">
      <header>
        <h1 className="font-heading text-[2.5rem] font-extrabold leading-none tracking-tight sm:text-5xl">
          Progres
        </h1>
        <p className="mt-3 max-w-[48ch] font-heading text-card-header font-semibold sm:text-2xl">
          Ini yang sudah kamu kumpulkan, dan soal yang masih layak diulang.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="mb-2 mr-2 flex flex-col gap-5 rounded-3xl bg-[var(--color-text)] p-6 text-[var(--color-bg-card)] shadow-[8px_8px_0_var(--color-cta)] sm:p-8">
          <p className="text-body-lg font-semibold text-[var(--color-bg-card)]/85">Total XP</p>
          <p className="font-heading text-[4.5rem] font-extrabold leading-none sm:text-[6rem]">
            <CountUp value={progress.total_xp} />
          </p>
          <div className="mt-auto">
            <div className="mb-2 flex items-center justify-between text-body">
              <span>Pelajaran selesai</span>
              <span className="font-semibold">
                {units === null ? "belum bisa dimuat" : `${doneLessons} dari ${totalLessons}`}
              </span>
            </div>
            {units !== null && totalLessons > 0 && (
              <div className="rounded-full bg-[var(--color-bg-card)]/15 p-1.5">
                <ProgressSegments
                  done={doneLessons}
                  total={totalLessons}
                  label={`${doneLessons} dari ${totalLessons} pelajaran selesai`}
                />
              </div>
            )}
          </div>
        </div>

        <Card className="flex flex-col divide-y-2 divide-[var(--color-text)]/15 border-2 border-[var(--color-text)]">
          <div className="flex flex-1 items-center gap-4 p-5 sm:p-6">
            <Flame size={32} className="shrink-0 text-[var(--color-cta)]" aria-hidden="true" />
            <div>
              <p className="font-heading text-4xl font-extrabold leading-none">
                {progress.current_streak}
                <span className="ml-1.5 text-card-header font-bold">hari</span>
              </p>
              <p className="mt-1 text-body">
                {progress.current_streak > 0
                  ? "Streak belajar berturut-turut"
                  : "Belum ada streak. Mulai dari lesson hari ini."}
              </p>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-4 p-5 sm:p-6">
            <div
              role="img"
              aria-label={`${hearts} dari ${MAX_HEARTS} heart tersisa`}
              className="flex shrink-0 gap-0.5"
            >
              {Array.from({ length: MAX_HEARTS }, (_, index) => (
                <Heart
                  key={index}
                  size={22}
                  aria-hidden="true"
                  className={
                    index < hearts
                      ? "fill-[var(--color-cta)] text-[var(--color-cta)]"
                      : "text-[var(--color-text)]/25"
                  }
                />
              ))}
            </div>
            <p className="text-body">
              {hearts === MAX_HEARTS || clock.nextIn === null
                ? "Heart penuh. Salah jawab di lesson ngurangin 1 heart dan 12 XP. Heart pertama balik 18 menit kemudian, berikutnya tiap 7 menit."
                : `${hearts} heart tersisa. Heart berikutnya balik dalam ${formatCountdown(clock.nextIn)}.`}
            </p>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeading title="Per unit" aside={courseTitle ?? undefined} />
        {units === null ? (
          <Card className="border-2 border-[var(--color-text)] p-6">
            <p className="text-body-lg">Daftar unit belum bisa dimuat. Muat ulang halaman ini.</p>
          </Card>
        ) : units.length === 0 ? (
          <Card className="border-2 border-[var(--color-text)] p-6">
            <p className="text-body-lg">Belum ada unit. Materinya lagi disiapin.</p>
          </Card>
        ) : (
          <Card className="divide-y-2 divide-[var(--color-text)]/15 border-2 border-[var(--color-text)]">
            {units.map((unit, unitIndex) => {
              const done = unit.lessons.filter((lesson) => lesson.completed).length;
              const total = unit.lessons.length;
              return (
                <div key={unit.unit_id} className="flex flex-col gap-3 p-5 sm:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-heading text-card-header font-bold">
                      Unit {unitIndex + 1}: {unit.title}
                    </p>
                    <p className="text-body font-semibold">
                      {total > 0 && done === total ? "Selesai" : `${done} dari ${total} lesson`}
                    </p>
                  </div>
                  <ProgressSegments
                    done={done}
                    total={total}
                    label={`${done} dari ${total} lesson di unit ${unitIndex + 1} selesai`}
                  />
                </div>
              );
            })}
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeading
          title="Badge"
          aside={`${badgeStats.earnedCount} dari ${badgeStats.total} terkumpul`}
        />
        <BadgeShelf badges={progress.badges} totalXp={progress.total_xp} />
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeading
          id="review"
          title="Review"
          aside={reviewCount === null ? undefined : `${reviewCount} soal menunggu`}
        />
        <p className="-mt-2 max-w-[60ch] text-body-lg">
          Soal yang pernah salah ada di sini. Jawab benar, soalnya keluar dari antrean dan kamu dapat
          +5 XP.
        </p>
        <ReviewSection items={reviewItems} onAttempt={onAttempt} onResolved={onResolved} />
      </div>
    </section>
  );
};

const ProgressSkeleton = () => (
  <section className="flex flex-col gap-8 py-8 sm:py-10" role="status" aria-label="Memuat progres">
    <div className="skeleton h-12 w-48 rounded-xl bg-[var(--color-text)]/10" />
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="skeleton h-64 rounded-3xl bg-[var(--color-text)]/20" />
      <div className="skeleton h-64 rounded-2xl bg-[var(--color-bg-card)]" />
    </div>
    <div className="skeleton h-40 rounded-2xl bg-[var(--color-bg-card)]" />
  </section>
);

const ProgressPage = () => {
  const { state, retry, patch } = useProgressPage();

  if (state.status === "loading") return <ProgressSkeleton />;

  if (state.status === "error") {
    return (
      <section className="py-10">
        <Card className="mx-auto flex max-w-xl flex-col items-start gap-4 border-2 border-[var(--color-text)] p-6 sm:p-8">
          <h1 className="font-heading text-heading font-bold">Progres gagal dimuat</h1>
          <p className="text-body-lg">{state.message}</p>
          <Button onClick={retry}>Coba lagi</Button>
        </Card>
      </section>
    );
  }

  const handleAttempt = (result: AttemptResult) =>
    patch((data) => ({
      ...data,
      progress: {
        ...data.progress,
        total_xp: data.progress.total_xp + result.xp_earned,
        hearts_remaining: result.hearts_remaining,
      },
      hearts: toHeartSnapshot(result),
    }));

  const handleResolved = (reviewId: string) =>
    patch((data) => ({
      ...data,
      reviewItems: data.reviewItems?.filter((item) => item.review_id !== reviewId) ?? null,
    }));

  return (
    <ProgressContent
      key={state.data.progress.user_id}
      data={state.data}
      onAttempt={handleAttempt}
      onResolved={handleResolved}
    />
  );
};

export default ProgressPage;
