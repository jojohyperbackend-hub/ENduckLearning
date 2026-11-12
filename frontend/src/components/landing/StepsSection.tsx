import { useEffect, useRef, useState } from "react";

const steps = [
  {
    title: "Login",
    description: "Pakai email atau akun Google. Gratis.",
  },
  {
    title: "Pilih lesson",
    description: "Mulai dari lesson pertama, yang berikutnya kebuka satu-satu.",
  },
  {
    title: "Kerjain soal",
    description: "Pilihan ganda, isi titik-titik, sampai terjemahan.",
  },
  {
    title: "Naik level",
    description: "Tiap jawaban benar nambah XP. Jaga streak, raih badge.",
  },
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
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
};

const StepsSection = () => {
  const { ref, isVisible } = useRevealOnScroll();

  return (
    <div
      ref={ref}
      className={`reveal flex flex-col gap-10 lg:gap-14 ${
        isVisible ? "is-visible" : ""
      }`}
    >
      <div className="flex flex-col gap-3 lg:items-center lg:text-center">
        <h2 className="font-heading text-heading font-bold">
          Mulai kecil, lanjut tiap hari
        </h2>
        <p className="max-w-[48ch] text-body-lg">
          Gak perlu langsung jago. Sepuluh menit sehari lebih kepake daripada
          belajar maraton seminggu sekali.
        </p>
      </div>

      {/* DESKTOP: node zigzag, card di sisi kosong */}
      <ol className="mx-auto hidden w-full max-w-4xl flex-col lg:flex">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isLeft = index % 2 === 0; // node di kiri, card di kanan

          return (
            <li
              key={step.title}
              className="relative grid h-44 grid-cols-2 items-center"
            >
              {/* Garis meliuk ke node berikutnya */}
              {!isLast && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute left-0 top-1/2 h-full w-full text-[var(--color-cta)]"
                >
                  <path
                    d={
                      isLeft
                        ? "M25 0 C 25 75, 75 25, 75 100"
                        : "M75 0 C 75 75, 25 25, 25 100"
                    }
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="0.1 8"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}

              {/* Node */}
              <div
                className={`relative z-10 row-start-1 flex justify-center ${
                  isLeft ? "col-start-1" : "col-start-2"
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--color-text)] bg-[var(--color-cta)] font-heading text-xl font-bold shadow-[3px_3px_0_var(--color-text)]">
                  {index + 1}
                </span>
              </div>

              {/* Card di sisi yang kosong */}
              <div
                className={`row-start-1 px-8 ${
                  isLeft ? "col-start-2" : "col-start-1"
                }`}
              >
                <div className="rounded-2xl border-2 border-[var(--color-text)] bg-[var(--color-bg-card)] p-5 shadow-[4px_4px_0_var(--color-text)]">
                  <h3 className="font-heading text-card-header font-bold">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-body-lg">{step.description}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* HP: 1 kolom, garis vertikal titik-titik */}
      <ol className="flex flex-col lg:hidden">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <li key={step.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-text)] bg-[var(--color-cta)] font-heading text-lg font-bold">
                  {index + 1}
                </span>
                {!isLast && (
                  <span className="my-1 w-0 flex-1 border-l-[3px] border-dotted border-[var(--color-cta)]" />
                )}
              </div>
              <div className={isLast ? "" : "pb-6"}>
                <div className="rounded-2xl border-2 border-[var(--color-text)] bg-[var(--color-bg-card)] p-4 shadow-[4px_4px_0_var(--color-text)]">
                  <h3 className="font-heading text-card-header font-bold">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-body-lg">{step.description}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default StepsSection;
