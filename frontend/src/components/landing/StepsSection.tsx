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
      { threshold: 0.15 }
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
      className={`reveal grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-12 ${
        isVisible ? "is-visible" : ""
      }`}
    >
      <div className="lg:col-span-2">
        <h2 className="font-heading text-heading font-bold">
          Mulai kecil, lanjut tiap hari
        </h2>
        <p className="mt-2 text-body-lg">
          Gak perlu langsung jago. Sepuluh menit sehari lebih kepake daripada
          belajar maraton seminggu sekali.
        </p>
      </div>

      <ol className="flex flex-col lg:col-span-3">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <li key={step.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-text)] bg-[var(--color-bg-card)] font-heading text-lg font-bold">
                  {index + 1}
                </span>
                {!isLast && (
                  <span className="w-0.5 flex-1 bg-[var(--color-text)]/20" />
                )}
              </div>
              <div className={isLast ? "pt-1" : "pb-7 pt-1"}>
                <h3 className="font-heading text-card-header font-bold">
                  {step.title}
                </h3>
                <p className="mt-1 text-body-lg">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default StepsSection;
