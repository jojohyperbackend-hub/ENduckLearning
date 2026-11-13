import { CheckCircle2, XCircle } from "lucide-react";
import type { AttemptResult } from "../../types";

interface FeedbackNoteProps {
  result: AttemptResult;
  // teks tambahan buat jawaban salah, misal "Soal ini masuk Review"
  wrongHint?: string;
}

const FeedbackNote = ({ result, wrongHint }: FeedbackNoteProps) => {
  const Icon = result.correct ? CheckCircle2 : XCircle;

  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon
        size={28}
        aria-hidden="true"
        className={`mt-0.5 shrink-0 ${
          result.correct ? "text-[var(--color-correct)]" : "text-[var(--color-wrong)]"
        }`}
      />
      <div className="min-w-0">
        <p
          className={`font-heading text-card-header font-bold leading-tight ${
            result.correct ? "text-[var(--color-correct)]" : "text-[var(--color-wrong)]"
          }`}
        >
          {result.correct
            ? result.xp_earned > 0
              ? `Benar, +${result.xp_earned} XP`
              : "Benar"
            : "Belum tepat"}
        </p>
        {result.feedback && (
          <p className="mt-1 text-body text-[var(--color-text)]">{result.feedback}</p>
        )}
        {result.grammar_note && (
          <p className="mt-1 text-body text-[var(--color-text)]">
            <span className="font-semibold">Catatan grammar: </span>
            {result.grammar_note}
          </p>
        )}
        {!result.correct && wrongHint && (
          <p className="mt-1 text-body text-[var(--color-text)]/80">{wrongHint}</p>
        )}
      </div>
    </div>
  );
};

export default FeedbackNote;
