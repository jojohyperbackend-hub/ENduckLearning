interface LessonProgressProps {
  total: number;
  current: number;
  // true = benar, false = salah, null = belum dijawab
  outcomes: (boolean | null)[];
}

// Satu ruas per soal. Terisi dari kiri: hijau kalau benar, merah kalau salah.
const LessonProgress = ({ total, current, outcomes }: LessonProgressProps) => {
  const answered = outcomes.filter((outcome) => outcome !== null).length;

  return (
    <div
      role="progressbar"
      aria-label="Progres lesson"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={answered}
      className="flex min-w-0 flex-1 gap-1.5"
    >
      {outcomes.map((outcome, index) => (
        <span
          key={index}
          className={`h-3 min-w-0 flex-1 overflow-hidden rounded-full ${
            index === current && outcome === null
              ? "bg-[var(--color-cta)]/35"
              : "bg-[var(--color-text)]/12"
          }`}
        >
          <span
            className={`block h-full origin-left rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none ${
              outcome === null
                ? "scale-x-0"
                : outcome
                  ? "scale-x-100 bg-[var(--color-correct)]"
                  : "scale-x-100 bg-[var(--color-wrong)]"
            }`}
          />
        </span>
      ))}
    </div>
  );
};

export default LessonProgress;
