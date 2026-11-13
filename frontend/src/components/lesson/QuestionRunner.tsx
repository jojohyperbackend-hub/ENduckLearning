import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { X } from "lucide-react";
import Button from "../common/Button";
import Card from "../common/Card";
import HeartsEmptyModal from "../common/HeartsEmptyModal";
import ExerciseCard from "./ExerciseCard";
import FeedbackNote from "./FeedbackNote";
import HeartsMeter from "./HeartsMeter";
import LessonProgress from "./LessonProgress";
import { getErrorMessage, isHeartsEmptyError } from "../../api/client";
import {
  loadHeartSnapshot,
  toHeartSnapshot,
  useHeartClock,
  type HeartSnapshot,
} from "../../hooks/useHeartClock";
import type { AttemptResult, Exercise } from "../../types";

export interface RunnerItem extends Exercise {
  // keterangan kecil di atas soal, misal asal soal di Latihan AI
  note?: string | null;
}

export interface RunStats {
  correct: number;
  wrong: number;
  total: number;
  xpGained: number;
}

interface QuestionRunnerProps {
  items: RunnerItem[];
  initialHearts: HeartSnapshot;
  exitLabel: string;
  wrongHint: string;
  finishLabel: string;
  submit: (item: RunnerItem, answer: string) => Promise<AttemptResult>;
  // Dipanggil setelah soal terakhir. Lempar error kalau gagal, runner yang nampilin.
  finish: (stats: RunStats) => Promise<void>;
}

const QuestionRunner = ({
  items,
  initialHearts,
  exitLabel,
  wrongHint,
  finishLabel,
  submit,
  finish,
}: QuestionRunnerProps) => {
  const navigate = useNavigate();
  const total = items.length;

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [outcomes, setOutcomes] = useState<(boolean | null)[]>(() => items.map(() => null));
  const [xpGained, setXpGained] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hearts, setHearts] = useState<HeartSnapshot>(initialHearts);
  // Heart 0 pas masuk (buka lewat URL langsung): soal gak boleh kelihatan sama sekali.
  const [blockedAtStart] = useState(() => initialHearts.hearts <= 0);
  const [heartsModal, setHeartsModal] = useState<HeartSnapshot | null>(() =>
    initialHearts.hearts <= 0 ? initialHearts : null,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const clock = useHeartClock(hearts);

  const item = items[index];
  const isLast = index === total - 1;

  const backToDashboard = useCallback(() => navigate("/dashboard", { replace: true }), [navigate]);

  // Setelah dinilai, fokus pindah ke tombol Lanjut biar Enter langsung jalan.
  useEffect(() => {
    if (result && !heartsModal) {
      panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }, [result, heartsModal]);

  const handleHeartsEmpty = useCallback(async () => {
    const snapshot = await loadHeartSnapshot();
    setHearts(snapshot);
    setHeartsModal(snapshot);
  }, []);

  const handleCheck = useCallback(async () => {
    if (isSubmitting || result || answer.trim() === "" || heartsModal) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const attempt = await submit(item, answer.trim());
      const snapshot = toHeartSnapshot(attempt);
      setResult(attempt);
      setHearts(snapshot);
      setOutcomes((previous) =>
        previous.map((outcome, position) => (position === index ? attempt.correct : outcome)),
      );
      setXpGained((previous) => previous + attempt.xp_earned);
      // Titik B: heart jadi 0 setelah jawaban salah, langsung popup.
      if (!attempt.correct && attempt.hearts_remaining <= 0) {
        setHeartsModal(snapshot);
      }
    } catch (error) {
      if (isHeartsEmptyError(error)) {
        await handleHeartsEmpty();
      } else {
        setActionError(getErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [answer, handleHeartsEmpty, heartsModal, index, isSubmitting, item, result, submit]);

  // Enter buat kirim jawaban pilihan ganda (kolom ketik punya handler sendiri).
  useEffect(() => {
    if (result || !item || item.type !== "multiple_choice" || heartsModal) return;
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "Enter" || !target) return;
      if (["INPUT", "TEXTAREA", "BUTTON", "A"].includes(target.tagName)) return;
      void handleCheck();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [item, result, heartsModal, handleCheck]);

  const handleFinish = async () => {
    setIsFinishing(true);
    setActionError(null);
    try {
      await finish({
        correct: outcomes.filter((outcome) => outcome === true).length,
        wrong: outcomes.filter((outcome) => outcome === false).length,
        total,
        xpGained,
      });
    } catch (error) {
      if (isHeartsEmptyError(error)) {
        await handleHeartsEmpty();
      } else {
        setActionError(getErrorMessage(error));
      }
    } finally {
      setIsFinishing(false);
    }
  };

  const handleContinue = () => {
    if (isLast) {
      void handleFinish();
      return;
    }
    setIndex((previous) => previous + 1);
    setAnswer("");
    setResult(null);
    setActionError(null);
  };

  if (blockedAtStart && heartsModal) {
    return (
      <section className="min-h-[60vh]" aria-label="Heart habis">
        <HeartsEmptyModal snapshot={heartsModal} onConfirm={backToDashboard} />
      </section>
    );
  }

  const panelTone = !result
    ? "bg-[var(--color-bg-card)]"
    : result.correct
      ? "bg-[#d9eddf]"
      : "bg-[#f9d9d4]";

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 pb-4 pt-4 sm:pt-8 md:min-h-0">
      <header className="flex items-center gap-3">
        <Link
          to="/dashboard"
          aria-label={exitLabel}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-[var(--color-text)] bg-[var(--color-bg-card)] transition hover:bg-[var(--color-bg)] active:scale-95"
        >
          <X size={20} aria-hidden="true" />
        </Link>
        <LessonProgress total={total} current={index} outcomes={outcomes} />
        <HeartsMeter hearts={clock.hearts} nextIn={clock.nextIn} />
      </header>

      <Card className="border-2 border-[var(--color-text)] p-5 shadow-[8px_8px_0_var(--color-cta)] sm:p-8">
        <ExerciseCard
          key={item.exercise_id}
          exercise={item}
          note={item.note ?? null}
          answer={answer}
          onAnswerChange={setAnswer}
          locked={isSubmitting || result !== null || heartsModal !== null}
          result={result}
          onSubmit={() => void handleCheck()}
        />
      </Card>

      <div
        ref={panelRef}
        aria-live="polite"
        className={`sticky bottom-3 z-30 mt-auto flex flex-col gap-3 rounded-2xl border-2 border-[var(--color-text)] p-4 shadow-[6px_6px_0_var(--color-text)] sm:flex-row sm:items-center sm:justify-between md:mt-0 ${panelTone}`}
      >
        {result ? (
          <FeedbackNote result={result} wrongHint={wrongHint} />
        ) : (
          <p className="text-body font-semibold text-[var(--color-text)]/75">
            Soal {index + 1} dari {total}
          </p>
        )}

        <div className="flex shrink-0 flex-col gap-2 sm:items-end [&>button]:w-full sm:[&>button]:w-auto">
          {actionError && (
            <p role="alert" className="text-body font-semibold text-[var(--color-wrong)]">
              {actionError}
            </p>
          )}
          {result ? (
            <Button
              onClick={handleContinue}
              disabled={heartsModal !== null}
              isLoading={isFinishing}
              loadingText="Menyimpan..."
            >
              {isLast ? finishLabel : "Lanjut"}
            </Button>
          ) : (
            <Button
              onClick={() => void handleCheck()}
              disabled={answer.trim() === "" || heartsModal !== null}
              isLoading={isSubmitting}
              loadingText={item.type === "translate" ? "AI lagi menilai..." : "Memeriksa..."}
            >
              Periksa
            </Button>
          )}
        </div>
      </div>

      {heartsModal && <HeartsEmptyModal snapshot={heartsModal} onConfirm={backToDashboard} />}
    </section>
  );
};

export default QuestionRunner;
