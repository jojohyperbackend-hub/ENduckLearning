import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Lock, Star } from "lucide-react";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import LessonSummary, { type LessonStats } from "../components/lesson/LessonSummary";
import QuestionRunner, { type RunnerItem } from "../components/lesson/QuestionRunner";
import GeneratingCard from "../components/quiz/GeneratingCard";
import QuizForm from "../components/quiz/QuizForm";
import { getErrorMessage } from "../api/client";
import { getMyProgress } from "../api/progressApi";
import { attemptQuizQuestion, completeQuiz, generateQuiz } from "../api/quizApi";
import {
  AI_XP_CORRECT,
  AI_XP_WRONG,
  checkAiPracticeAccess,
  type AiPracticeLockReason,
} from "../utils/aiPracticeAccess";
import type { QuizFormOptions, QuizFormRequest, QuizResult } from "../types";

type Phase =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "locked"; reason: AiPracticeLockReason; message: string }
  | { name: "form"; options: QuizFormOptions }
  | { name: "generating"; options: QuizFormOptions; count: number; startedAt: number }
  | { name: "playing"; quiz: QuizResult; requested: number }
  | { name: "summary"; stats: LessonStats };

const toRunnerItems = (quiz: QuizResult): RunnerItem[] =>
  quiz.questions.map((question) => ({
    exercise_id: question.question_id,
    type: question.type,
    topic: question.topic,
    question: question.question_text,
    options: question.options,
    note: question.source === "fallback_original" ? "Soal dari bank soal" : null,
  }));

const PageHeader = ({ showRules }: { showRules: boolean }) => (
  <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="font-heading text-[2.5rem] font-extrabold leading-none tracking-tight sm:text-5xl">
        Latihan AI
      </h1>
      <p className="mt-3 max-w-[46ch] font-heading text-card-header font-semibold sm:text-2xl">
        Soal baru buatan AI dari topik yang sudah kamu pelajari, beda dari soal lesson.
      </p>
    </div>
    {showRules && <XpRules />}
  </header>
);

// Latihan AI gak pakai heart: aturan poinnya ditaruh di header biar jelas dari awal.
const XpRules = () => (
  <div className="flex w-fit shrink-0 items-center gap-3 rounded-2xl border-2 border-[var(--color-text)]/15 bg-[var(--color-bg-card)] px-4 py-2.5">
    <Star size={20} className="fill-[var(--color-cta)] text-[var(--color-cta)]" aria-hidden="true" />
    <div className="text-body leading-snug">
      <p>
        Benar <span className="font-bold">+{AI_XP_CORRECT} XP</span>
      </p>
      <p>
        Salah <span className="font-bold">&minus;{AI_XP_WRONG} XP</span>, heart aman
      </p>
    </div>
  </div>
);

const LOCK_EXPLANATION: Record<AiPracticeLockReason, string> = {
  gate1: "AI butuh tahu dulu materi yang sudah kamu pelajari biar soalnya pas.",
  xp: "Tiap lesson yang kamu kerjain nambah XP. Balik lagi ke sini kalau XP-nya udah cukup.",
};

const LockedCard = ({ reason, message }: { reason: AiPracticeLockReason; message: string }) => (
  <Card className="flex flex-col items-start gap-4 border-2 border-[var(--color-text)] p-6 sm:p-8">
    <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-text)] text-[var(--color-bg-card)]">
      <Lock size={24} aria-hidden="true" />
    </span>
    <h2 className="font-heading text-[2rem] font-extrabold leading-none">Latihan AI belum kebuka</h2>
    <p className="max-w-[48ch] text-body-lg">{message}</p>
    <p className="max-w-[48ch] text-body">{LOCK_EXPLANATION[reason]}</p>
    <Link
      to="/dashboard"
      className="inline-flex items-center rounded-full border border-[var(--color-text)]/70 bg-[var(--color-cta)] px-6 py-3 text-body-lg font-bold shadow-[0_4px_0_rgba(40,60,99,0.8)] transition hover:bg-[var(--color-cta-soft)] active:translate-y-0.5"
    >
      Ke lesson berikutnya
    </Link>
  </Card>
);

const QuizGeneratePage = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [formError, setFormError] = useState<string | null>(null);
  const [lastForm, setLastForm] = useState<QuizFormRequest | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Buka halaman (dari dashboard atau navbar): cek Gerbang 1 sebelum form muncul.
  useEffect(() => {
    let cancelled = false;
    checkAiPracticeAccess()
      .then((access) => {
        if (cancelled) return;
        if (access.status === "locked")
          setPhase({ name: "locked", reason: access.reason, message: access.message });
        else setPhase({ name: "form", options: access.options });
      })
      .catch((error) => {
        if (!cancelled) setPhase({ name: "error", message: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const reload = () => {
    setPhase({ name: "loading" });
    setFormError(null);
    setLoadAttempt((count) => count + 1);
  };

  const handleGenerate = async (form: QuizFormRequest) => {
    if (phase.name !== "form") return;
    const { options } = phase;
    setLastForm(form);
    setFormError(null);
    setPhase({ name: "generating", options, count: form.jumlah_soal, startedAt: performance.now() });

    try {
      const quiz = await generateQuiz(form);
      setPhase({ name: "playing", quiz, requested: form.jumlah_soal });
    } catch (error) {
      setPhase({ name: "form", options });
      setFormError(getErrorMessage(error));
    }
  };

  // Angka akhir diambil dari server (sumber kebenaran XP bersih), bukan hitungan lokal runner.
  const handleFinish = async (quiz: QuizResult) => {
    const completed = await completeQuiz(quiz.quiz_id);
    const progress = await getMyProgress().catch(() => null);
    setPhase({
      name: "summary",
      stats: {
        correct: completed.jumlah_benar,
        wrong: completed.jumlah_salah,
        total: completed.total_soal,
        xpGained: completed.total_xp_earned,
        totalXp: progress?.total_xp ?? 0,
        badge: completed.badge_earned,
      },
    });
  };

  if (phase.name === "playing") {
    const { quiz, requested } = phase;
    return (
      <QuestionRunner
        key={quiz.quiz_id}
        items={toRunnerItems(quiz)}
        initialHearts={null}
        exitLabel="Keluar dari Latihan AI"
        wrongHint={
          quiz.total_soal < requested
            ? `AI cuma berhasil bikin ${quiz.total_soal} dari ${requested} soal yang lolos cek. Topik ini bakal lebih sering muncul di mode Otomatis.`
            : "Topik ini bakal lebih sering muncul di Latihan AI mode Otomatis."
        }
        finishLabel="Lihat hasil"
        submit={(item, answer) => attemptQuizQuestion(quiz.quiz_id, item.exercise_id, answer)}
        finish={() => handleFinish(quiz)}
      />
    );
  }

  if (phase.name === "summary") {
    const { stats } = phase;
    const isPerfect = stats.total > 0 && stats.wrong === 0;
    return (
      <LessonSummary
        stats={stats}
        title="Latihan selesai"
        message={
          isPerfect
            ? "Semua benar. Coba naikin tingkat kesulitannya di latihan berikutnya."
            : `${stats.wrong} soal salah, XP-nya kepotong tapi heart kamu aman. Topiknya diprioritaskan kalau kamu pakai mode Otomatis.`
        }
        onFinish={() => navigate("/dashboard")}
        secondary={{ label: "Latihan lagi", onClick: reload }}
      />
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-8 sm:py-10">
      <PageHeader showRules={phase.name === "form" || phase.name === "generating"} />

      {phase.name === "loading" && (
        <div role="status" aria-label="Memuat Latihan AI" className="flex flex-col gap-4">
          <div className="skeleton h-96 rounded-2xl bg-[var(--color-bg-card)]" />
        </div>
      )}

      {phase.name === "error" && (
        <Card className="flex flex-col items-start gap-4 border-2 border-[var(--color-text)] p-6 sm:p-8">
          <h2 className="font-heading text-heading font-bold">Latihan AI gagal dimuat</h2>
          <p className="text-body-lg">{phase.message}</p>
          <Button onClick={reload}>Coba lagi</Button>
        </Card>
      )}

      {phase.name === "locked" && <LockedCard reason={phase.reason} message={phase.message} />}

      {phase.name === "form" && (
        <QuizForm
          topics={phase.options.available_topics}
          isSubmitting={false}
          error={formError}
          initial={lastForm}
          onSubmit={(form) => void handleGenerate(form)}
        />
      )}

      {phase.name === "generating" && (
        <GeneratingCard count={phase.count} startedAt={phase.startedAt} />
      )}
    </section>
  );
};

export default QuizGeneratePage;
