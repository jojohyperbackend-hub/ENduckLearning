import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, PartyPopper } from "lucide-react";
import Button from "../common/Button";
import HeartsEmptyModal from "../common/HeartsEmptyModal";
import ExerciseCard from "../lesson/ExerciseCard";
import FeedbackNote from "../lesson/FeedbackNote";
import { attemptReview } from "../../api/progressApi";
import { getErrorMessage, isHeartsEmptyError } from "../../api/client";
import { loadHeartSnapshot, toHeartSnapshot, type HeartSnapshot } from "../../hooks/useHeartClock";
import type { AttemptResult, ReviewQueueItem } from "../../types";
import { topicLabel } from "../../utils/formatters";

interface ReviewRowProps {
  item: ReviewQueueItem;
  isOpen: boolean;
  onToggle: () => void;
  // dipanggil tiap jawaban dinilai: XP & hati langsung ikut berubah di atas
  onAttempt: (result: AttemptResult) => void;
  // dipanggil saat soal benar dan baris ditutup: soal keluar dari antrean
  onResolved: (reviewId: string) => void;
  onHeartsEmpty: (hearts: HeartSnapshot) => void;
}

const ReviewRow = ({
  item,
  isOpen,
  onToggle,
  onAttempt,
  onResolved,
  onHeartsEmpty,
}: ReviewRowProps) => {
  const exercise = item.exercise;
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!exercise) return null;

  const handleCheck = async () => {
    if (isSubmitting || result || answer.trim() === "") return;
    setIsSubmitting(true);
    setError(null);
    try {
      const attempt = await attemptReview(item.review_id, answer.trim());
      setResult(attempt);
      onAttempt(attempt);
      if (!attempt.correct && attempt.hearts_remaining <= 0) {
        onHeartsEmpty(toHeartSnapshot(attempt));
      }
    } catch (err) {
      if (isHeartsEmptyError(err)) {
        onHeartsEmpty(await loadHeartSnapshot());
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const retry = () => {
    setAnswer("");
    setResult(null);
    setError(null);
  };

  const panelId = `review-${item.review_id}`;

  return (
    <li className="border-b-2 border-[var(--color-text)]/15 last:border-b-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-4 text-left transition hover:bg-[var(--color-bg)]/60 sm:px-6"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-body-sm font-semibold text-[var(--color-cta)]">
            {topicLabel(exercise.topic)}
          </span>
          <span className="mt-0.5 block break-words text-body-lg font-medium">
            {exercise.question}
          </span>
        </span>
        <ChevronDown
          size={20}
          aria-hidden="true"
          className={`shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div id={panelId} className="flex flex-col gap-5 px-4 pb-6 pt-2 sm:px-6">
          <ExerciseCard
            exercise={exercise}
            answer={answer}
            onAnswerChange={setAnswer}
            locked={isSubmitting || result !== null}
            result={result}
            onSubmit={() => void handleCheck()}
          />

          {result && (
            <div
              aria-live="polite"
              className={`rounded-2xl border-2 border-[var(--color-text)] p-4 ${
                result.correct ? "bg-[#d9eddf]" : "bg-[#f9d9d4]"
              }`}
            >
              <FeedbackNote
                result={result}
                wrongHint="Soalnya tetap di Review sampai kamu jawab benar."
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-body font-semibold text-[var(--color-wrong)]">
              {error}
            </p>
          )}

          <div className="[&>button]:w-full sm:[&>button]:w-auto">
            {!result ? (
              <Button
                onClick={() => void handleCheck()}
                disabled={answer.trim() === ""}
                isLoading={isSubmitting}
                loadingText={exercise.type === "translate" ? "AI lagi menilai..." : "Memeriksa..."}
              >
                Periksa
              </Button>
            ) : result.correct ? (
              <Button onClick={() => onResolved(item.review_id)}>Selesai</Button>
            ) : (
              <Button onClick={retry}>Coba lagi</Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
};

interface ReviewSectionProps {
  items: ReviewQueueItem[] | null;
  onAttempt: (result: AttemptResult) => void;
  onResolved: (reviewId: string) => void;
}

const ReviewSection = ({ items, onAttempt, onResolved }: ReviewSectionProps) => {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const [heartsModal, setHeartsModal] = useState<HeartSnapshot | null>(null);
  const backToDashboard = useCallback(() => navigate("/dashboard", { replace: true }), [navigate]);

  if (items === null) {
    return (
      <div className="rounded-2xl border-2 border-[var(--color-text)] bg-[var(--color-bg-card)] p-6">
        <p className="font-heading text-card-header font-bold">Review belum bisa dimuat</p>
        <p className="mt-1 text-body-lg">Muat ulang halaman ini untuk mencoba lagi.</p>
      </div>
    );
  }

  const playable = items.filter((item) => item.exercise !== null);
  const hidden = items.length - playable.length;

  if (playable.length === 0) {
    return (
      <div className="flex items-start gap-4 rounded-2xl border-2 border-[var(--color-text)] bg-[var(--color-bg-card)] p-6">
        <PartyPopper size={28} className="mt-0.5 shrink-0 text-[var(--color-cta)]" aria-hidden="true" />
        <div>
          <p className="font-heading text-card-header font-bold">Review kosong</p>
          <p className="mt-1 max-w-[52ch] text-body-lg">
            Tidak ada soal yang perlu diulang. Soal yang kamu jawab salah di lesson akan muncul di
            sini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-[var(--color-text)] bg-[var(--color-bg-card)]">
      <ul className="m-0 list-none p-0">
        {playable.map((item) => (
          <ReviewRow
            key={item.review_id}
            item={item}
            isOpen={openId === item.review_id}
            onToggle={() => setOpenId((current) => (current === item.review_id ? null : item.review_id))}
            onAttempt={onAttempt}
            onResolved={(reviewId) => {
              setOpenId(null);
              onResolved(reviewId);
            }}
            onHeartsEmpty={setHeartsModal}
          />
        ))}
      </ul>
      {hidden > 0 && (
        <p className="border-t-2 border-[var(--color-text)]/15 px-4 py-3 text-body-sm text-[var(--color-text)]/75 sm:px-6">
          {hidden} soal dari Latihan AI ada di antrean, tapi isinya belum bisa ditampilkan di sini.
        </p>
      )}
      {heartsModal && <HeartsEmptyModal snapshot={heartsModal} onConfirm={backToDashboard} />}
    </div>
  );
};

export default ReviewSection;
