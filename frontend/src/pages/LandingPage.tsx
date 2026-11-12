import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowUp } from "lucide-react";
import BenefitSection from "../components/landing/BenefitSection";
import HeroSection from "../components/landing/HeroSection";
import StepsSection from "../components/landing/StepsSection";
import Button from "../components/common/Button";

const team = [
  { name: "Ata", role: "Full stack, leader" },
  { name: "Ali", role: "Backend" },
  { name: "Anas", role: "Frontend" },
  {name: "Gabe", role: " ui ux"},
];

const useInView = () => {
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
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
};

const useCountUp = (target: number, shouldStart: boolean, durationMs = 800) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!shouldStart) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) {
      const timeoutId = setTimeout(() => setValue(target), 0);
      return () => clearTimeout(timeoutId);
    }

    const startTime = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      setValue(Math.round(progress * target));
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [shouldStart, target, durationMs]);

  return value;
};

const StatsBar = () => {
  const { ref, isVisible } = useInView();
  const lessonCount = useCountUp(15, isVisible);
  const soalCount = useCountUp(75, isVisible);

  return (
    <div
      ref={ref}
      className="flex flex-wrap items-baseline gap-x-10 gap-y-3 border-y-2 border-[var(--color-text)] py-5"
    >
      <p className="flex items-baseline gap-2">
        <span className="font-heading text-4xl font-extrabold leading-none">
          {lessonCount}
        </span>
        <span className="text-body-lg">lesson</span>
      </p>
      <p className="flex items-baseline gap-2">
        <span className="font-heading text-4xl font-extrabold leading-none">
          {soalCount}+
        </span>
        <span className="text-body-lg">soal latihan</span>
      </p>
      <p className="text-body-lg">Plus soal tambahan dari AI sesuai kelemahanmu.</p>
    </div>
  );
};

const TeamSection = () => {
  return (
    <div className="grid gap-8 lg:grid-cols-[0.382fr_0.618fr] lg:gap-14">
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-heading font-bold leading-tight sm:text-4xl">
          Dibikin berempat
        </h2>
        <p className="max-w-[36ch] text-body-lg leading-7">
          Proyek tim kami untuk LOGICODIX 2026.
        </p>
      </div>
      <ul className="grid gap-6 sm:grid-cols-3">
        {team.map((member) => (
          <li
            key={member.name}
            className="border-l-4 border-[var(--color-cta)] pl-4"
          >
            <p className="font-heading text-3xl font-bold leading-none">
              {member.name}
            </p>
            <p className="mt-2 text-body-lg">{member.role}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

const FinalCtaSection = () => {
  return (
    <div className="flex flex-col items-start gap-6 rounded-3xl bg-[var(--color-text)] px-6 py-10 text-[var(--color-bg-card)] sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:justify-between">
      <h2 className="max-w-[18ch] font-heading text-3xl font-bold leading-tight sm:text-4xl">
        Satu lesson dulu, sisanya nanti.
      </h2>
      <Link to="/login">
        <Button size="lg">Daftar gratis</Button>
      </Link>
    </div>
  );
};

const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > window.innerHeight);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Kembali ke atas"
      className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-cta)] text-[var(--color-text)] shadow-[0_8px_24px_rgba(40,60,99,0.16)] transition hover:scale-[1.03] active:scale-[0.98] motion-reduce:hover:scale-100"
    >
      <ArrowUp size={20} />
    </button>
  );
};

const LandingPage = () => {
  return (
    <section className="flex flex-col py-8 sm:py-10">
      <div id="beranda" className="scroll-mt-28">
        <HeroSection />
      </div>
      <div className="mt-[55px]">
        <StatsBar />
      </div>
      <div id="fitur" className="mt-16 lg:mt-[89px] scroll-mt-28">
        <BenefitSection />
      </div>
      <div id="cara-kerja" className="mt-[55px] scroll-mt-28">
        <StepsSection />
      </div>
      <div id="tim" className="mt-16 lg:mt-[89px] scroll-mt-28">
        <TeamSection />
      </div>
      <div className="mt-[55px]">
        <FinalCtaSection />
      </div>
      <ScrollToTopButton />
    </section>
  );
};

export default LandingPage;
