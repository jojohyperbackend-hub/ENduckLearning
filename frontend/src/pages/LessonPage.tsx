import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import LessonSummary, { type LessonStats } from "../components/lesson/LessonSummary";
import QuestionRunner, { type RunStats } from "../components/lesson/QuestionRunner";
import { useLesson } from "../hooks/useLesson";
import type { HeartSnapshot } from "../hooks/useHeartClock";
import type { AttemptResult, Exercise, LessonCompleteResult, LessonDetail } from "../types";

interface LessonFlowProps {
  lesson: LessonDetail;
  hearts: HeartSnapshot;
  submitAnswer: (exercise: Exercise, answer: string) => Promise<AttemptResult>;
  finish: () => Promise<LessonCompleteResult>;
}

const LessonFlow = ({ lesson, hearts, submitAnswer, finish }: LessonFlowProps) => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<LessonStats | null>(null);

  const handleFinish = async (stats: RunStats) => {
    const completed = await finish();
    setSummary({
      ...stats,
      totalXp: completed.xp_earned_total,
      badge: completed.badge_earned,
    });
  };

  if (summary) {
    const isPerfect = summary.total > 0 && summary.wrong === 0;
    return (
      <LessonSummary
        stats={summary}
        title="Lesson selesai"
        message={
          isPerfect
            ? "Semua jawabanmu benar. Lanjut ke lesson berikutnya selagi lagi lancar."
            : `${summary.wrong} soal yang salah masuk ke Review, jadi bisa diulang kapan saja.`
        }
        onFinish={() => navigate("/dashboard")}
        secondary={summary.wrong > 0 ? { label: "Buka Review", to: "/progress#review" } : null}
      />
    );
  }

  return (
    <QuestionRunner
      items={lesson.exercises}
      initialHearts={hearts}
      exitLabel="Keluar dari lesson"
      wrongHint="Heart −1. Soal ini masuk Review supaya bisa kamu ulang nanti."
      finishLabel="Selesaikan lesson"
      submit={submitAnswer}
      finish={handleFinish}
    />
  );
};

const LessonSkeleton = () => (
  <section
    className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-8"
    role="status"
    aria-label="Memuat lesson"
  >
    <div className="skeleton h-10 rounded-full bg-[var(--color-text)]/10" />
    <div className="skeleton h-80 rounded-2xl bg-[var(--color-bg-card)]" />
  </section>
);

const LessonMessage = ({
  title,
  message,
  canReload,
}: {
  title: string;
  message: string;
  canReload?: boolean;
}) => (
  <section className="py-10">
    <Card className="mx-auto flex max-w-xl flex-col items-start gap-4 border-2 border-[var(--color-text)] p-6 sm:p-8">
      <h1 className="font-heading text-heading font-bold">{title}</h1>
      <p className="text-body-lg">{message}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center rounded-full border-2 border-[var(--color-text)] bg-[var(--color-cta)] px-6 py-3 text-body-lg font-bold transition hover:bg-[var(--color-cta-soft)] active:scale-[0.98]"
        >
          Kembali ke dashboard
        </Link>
        {canReload && (
          <Button variant="default" onClick={() => window.location.reload()}>
            Muat ulang
          </Button>
        )}
      </div>
    </Card>
  </section>
);

const LessonPage = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { lesson, hearts, isLoading, error, submitAnswer, finish } = useLesson(lessonId);

  if (isLoading) return <LessonSkeleton />;

  if (error || !lesson || !hearts) {
    const isLocked = error?.toLowerCase().includes("terkunci");
    return (
      <LessonMessage
        title={isLocked ? "Lesson masih terkunci" : "Lesson gagal dimuat"}
        message={error ?? "Lesson tidak ditemukan."}
        canReload={!isLocked}
      />
    );
  }

  if (lesson.exercises.length === 0) {
    return (
      <LessonMessage
        title="Lesson ini belum punya soal"
        message="Soalnya belum disiapin. Coba lesson lain dulu, atau cek lagi nanti."
      />
    );
  }

  return (
    <LessonFlow
      key={lesson.lesson_id}
      lesson={lesson}
      hearts={hearts}
      submitAnswer={submitAnswer}
      finish={finish}
    />
  );
};

export default LessonPage;
