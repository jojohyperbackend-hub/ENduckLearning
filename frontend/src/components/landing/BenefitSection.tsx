import { useEffect, useRef, useState } from "react";
import { Check, Flame } from "lucide-react";
import Card from "../common/Card";

const QUIZ_OPTIONS = ["go", "goes", "going", "gone"];
const QUIZ_ANSWER = "goes";

const WEEK = [
  { day: "Sen", done: true },
  { day: "Sel", done: true },
  { day: "Rab", done: true },
  { day: "Kam", done: true },
  { day: "Jum", done: true },
  { day: "Sab", done: false },
  { day: "Min", done: false },
];

const WEAK_TOPICS = [
  { topic: "Simple present", accuracy: 45 },
  { topic: "Preposition", accuracy: 60 },
  { topic: "Past tense", accuracy: 85 },
];

const useRevealOnScroll = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
};

const TryQuestion = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const isCorrect = selected === QUIZ_ANSWER;

  const handlePick = (option: string) => {
    if (isCorrect) return;
    setSelected(option);
    setAttempt((count) => count + 1);
  };

  return (
    <Card className="flex h-full flex-col gap-5 p-5 sm:p-7">
      <div>
        <h3 className="font-heading text-card-header font-bold">
          Lesson pendek, langsung dikerjain
        </h3>
        <p className="mt-1 text-body">
          Tiap lesson isinya beberapa soal kayak gini. Cobain satu:
        </p>
      </div>

      <p className="font-heading text-2xl font-bold sm:text-3xl">
        She{" "}
        <span className="inline-block min-w-16 border-b-4 border-[var(--color-text)]/30 text-center text-[var(--color-cta)]">
          {isCorrect ? QUIZ_ANSWER : " "}
        </span>{" "}
        to school every day.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {QUIZ_OPTIONS.map((option) => {
          const isPicked = selected === option;
          const pickedWrong = isPicked && !isCorrect;
          const pickedRight = isPicked && isCorrect;

          return (
            <button
              key={pickedWrong ? `${option}-${attempt}` : option}
              type="button"
              onClick={() => handlePick(option)}
              aria-pressed={isPicked}
              className={[
                "rounded-2xl border-2 bg-[var(--color-bg)] px-4 py-3 text-left text-body-lg font-semibold transition-colors",
                "shadow-[0_3px_0_rgba(40,60,99,0.25)] active:translate-y-[2px] active:shadow-[0_1px_0_rgba(40,60,99,0.25)]",
                pickedRight
                  ? "animate-pulse-correct border-[var(--color-correct)] text-[var(--color-correct)]"
                  : pickedWrong
                    ? "animate-shake-wrong border-[var(--color-wrong)] text-[var(--color-wrong)]"
                    : "border-[var(--color-text)]/20 hover:border-[var(--color-text)]/50",
              ].join(" ")}
            >
              {option}
            </button>
          );
        })}
      </div>

      <p className="min-h-6 text-body-lg font-semibold" aria-live="polite">
        {isCorrect && (
          <span className="text-[var(--color-correct)]">Mantap! +10 XP 🎉</span>
        )}
        {selected && !isCorrect && (
          <span className="text-[var(--color-wrong)]">
            Belum tepat, coba lagi!
          </span>
        )}
      </p>
    </Card>
  );
};

const BenefitSection = () => {
  const { ref, isVisible } = useRevealOnScroll();

  return (
    <div
      ref={ref}
      className={`reveal flex flex-col gap-6 ${isVisible ? "is-visible" : ""}`}
    >
      <div className="max-w-2xl">
        <h2 className="font-heading text-heading font-bold">
          Belajarnya dikit-dikit, tapi tiap hari
        </h2>
        <p className="mt-2 text-body-lg">
          Gak ada hafalan panjang. Kamu jawab soal, langsung tahu benar atau
          salah, terus lanjut.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TryQuestion />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
            <div>
              <h3 className="font-heading text-card-header font-bold">
                Streak yang bikin balik lagi
              </h3>
              <p className="mt-1 text-body">
                Belajar hari ini, streak nambah. Kumpulin XP buat buka badge.
              </p>
            </div>
            <div className="flex items-center justify-between gap-1">
              {WEEK.map(({ day, done }) => (
                <div key={day} className="flex flex-col items-center gap-1">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 sm:h-9 sm:w-9 ${
                      done
                        ? "border-[var(--color-cta)] bg-[var(--color-cta)] text-[var(--color-bg-card)]"
                        : "border-dashed border-[var(--color-text)]/30"
                    }`}
                  >
                    {done && <Check size={16} strokeWidth={3} />}
                  </span>
                  <span className="text-body-sm">{day}</span>
                </div>
              ))}
            </div>
            <p className="flex items-center gap-1 text-body font-semibold">
              <Flame size={16} className="text-[var(--color-cta)]" />5 hari
              berturut-turut
            </p>
          </Card>

          <Card className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
            <div>
              <h3 className="font-heading text-card-header font-bold">
                Latihan AI buat topik yang masih lemah
              </h3>
              <p className="mt-1 text-body">
                AI lihat topik yang sering kamu salah, lalu bikinin soal baru
                khusus topik itu.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {WEAK_TOPICS.map(({ topic, accuracy }) => (
                <li key={topic} className="flex items-center gap-3 text-body">
                  <span className="w-28 shrink-0">{topic}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-text)]/10">
                    <span
                      className={`block h-full rounded-full ${
                        accuracy < 70
                          ? "bg-[var(--color-wrong)]"
                          : "bg-[var(--color-correct)]"
                      }`}
                      style={{ width: `${accuracy}%` }}
                    />
                  </span>
                  <span className="w-9 shrink-0 text-right font-semibold">
                    {accuracy}%
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-body-sm text-[var(--color-text)]/70">
              Contoh tampilan. Angkanya nanti dari jawabanmu sendiri.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BenefitSection;
