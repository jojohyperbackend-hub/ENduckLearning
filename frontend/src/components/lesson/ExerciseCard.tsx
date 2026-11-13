import { useEffect, useMemo, useRef } from "react";
import type { AttemptResult, Exercise } from "../../types";
import { exerciseTypeLabel, topicLabel } from "../../utils/formatters";

interface ExerciseCardProps {
  exercise: Exercise;
  // keterangan kecil tambahan di baris label, misal asal soal
  note?: string | null;
  answer: string;
  onAnswerChange: (value: string) => void;
  // true = jawaban lagi dikirim atau sudah dinilai, input dikunci
  locked: boolean;
  result: AttemptResult | null;
  onSubmit: () => void;
}

const inputBase =
  "w-full rounded-2xl border-2 border-[var(--color-text)] bg-white px-4 py-3 text-body-lg text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text)]/45 focus:border-[var(--color-cta)] disabled:cursor-not-allowed disabled:opacity-70";

const hasFinePointer = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

// Garis kosong "___" di soal fill_blank digambar sebagai garis bawah beneran.
const QuestionText = ({ exercise }: { exercise: Exercise }) => {
  const parts =
    exercise.type === "fill_blank" ? exercise.question.split(/(_{2,})/) : [exercise.question];

  return (
    <h2 className="font-heading text-[1.75rem] font-bold leading-snug sm:text-4xl sm:leading-tight">
      {parts.map((part, index) =>
        /^_{2,}$/.test(part) ? (
          <span
            key={index}
            aria-label="bagian kosong"
            className="mx-1 inline-block w-16 translate-y-[-2px] border-b-4 border-[var(--color-cta)] align-baseline sm:w-24"
          />
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </h2>
  );
};

const ExerciseCard = ({
  exercise,
  note = null,
  answer,
  onAnswerChange,
  locked,
  result,
  onSubmit,
}: ExerciseCardProps) => {
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const options = useMemo(() => exercise.options ?? [], [exercise.options]);

  // Di HP jangan langsung munculin keyboard; di laptop fokus ke kolom jawaban.
  useEffect(() => {
    if (exercise.type !== "multiple_choice" && hasFinePointer()) {
      fieldRef.current?.focus();
    }
  }, [exercise.exercise_id, exercise.type]);

  // Tombol 1-4 buat pilih jawaban di soal pilihan ganda.
  useEffect(() => {
    if (exercise.type !== "multiple_choice" || locked) return;
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < options.length) {
        onAnswerChange(options[index]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [exercise.type, locked, options, onAnswerChange]);

  const handleEnter = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="flex flex-wrap items-center gap-x-2 text-body font-semibold text-[var(--color-text)]/75">
          <span>{exerciseTypeLabel(exercise.type)}</span>
          <span aria-hidden="true">/</span>
          <span>{topicLabel(exercise.topic)}</span>
          {note && (
            <>
              <span aria-hidden="true">/</span>
              <span>{note}</span>
            </>
          )}
        </p>
        <div className="mt-3">
          <QuestionText exercise={exercise} />
        </div>
      </div>

      {exercise.type === "multiple_choice" && (
        <div role="radiogroup" aria-label="Pilihan jawaban" className="flex flex-col gap-3">
          {options.map((option, index) => {
            const isSelected = answer === option;
            let state = "border-[var(--color-text)]/30 bg-[var(--color-bg-card)] hover:border-[var(--color-text)]";
            if (isSelected && !result) {
              state = "border-[var(--color-cta)] bg-[var(--color-cta)]/10";
            } else if (isSelected && result?.correct) {
              state =
                "border-[var(--color-correct)] bg-[var(--color-correct)]/10 animate-pulse-correct";
            } else if (isSelected && result) {
              state = "border-[var(--color-wrong)] bg-[var(--color-wrong)]/10 animate-shake-wrong";
            } else if (result) {
              state = "border-[var(--color-text)]/15 bg-[var(--color-bg-card)] opacity-60";
            }

            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={locked}
                onClick={() => onAnswerChange(option)}
                className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-body-lg font-medium transition-colors disabled:cursor-default ${state}`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 font-heading text-body-lg font-bold ${
                    isSelected
                      ? "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg-card)]"
                      : "border-[var(--color-text)]/40"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 break-words">{option}</span>
              </button>
            );
          })}
        </div>
      )}

      {exercise.type === "fill_blank" && (
        <label className="block">
          <span className="sr-only">Jawabanmu</span>
          <input
            ref={fieldRef}
            type="text"
            value={answer}
            disabled={locked}
            onChange={(event) => onAnswerChange(event.target.value)}
            onKeyDown={handleEnter}
            placeholder="Ketik jawabanmu"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={120}
            className={`${inputBase} text-xl ${
              result
                ? result.correct
                  ? "border-[var(--color-correct)]"
                  : "border-[var(--color-wrong)] animate-shake-wrong"
                : ""
            }`}
          />
        </label>
      )}

      {exercise.type === "translate" && (
        <label className="block">
          <span className="sr-only">Terjemahanmu</span>
          <textarea
            ref={fieldRef}
            value={answer}
            disabled={locked}
            onChange={(event) => onAnswerChange(event.target.value)}
            onKeyDown={handleEnter}
            rows={3}
            placeholder="Tulis terjemahanmu di sini"
            autoComplete="off"
            spellCheck={false}
            maxLength={400}
            className={`${inputBase} resize-none text-lg ${
              result
                ? result.correct
                  ? "border-[var(--color-correct)]"
                  : "border-[var(--color-wrong)] animate-shake-wrong"
                : ""
            }`}
          />
          <span className="mt-2 block text-body-sm text-[var(--color-text)]/70">
            Dinilai dari maknanya, bukan kata per kata. Enter untuk kirim, Shift+Enter untuk baris
            baru.
          </span>
        </label>
      )}
    </div>
  );
};

export default ExerciseCard;
