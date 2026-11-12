import { useEffect, useState } from "react";
import { Link } from "react-router";
import Button from "../common/Button";
import illustration from "../../assets/landing.png";

const HeroSection = () => {
  const [parallaxY, setParallaxY] = useState(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const handleScroll = () => {
      // parallax cuma di desktop, di HP gambarnya di bawah teks jadi bakal nabrak
      if (window.innerWidth < 1024) {
        setParallaxY(0);
        return;
      }
      setParallaxY(Math.min(window.scrollY, 600) * -0.12);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section className="flex flex-col gap-8 pt-2 sm:gap-10 md:flex-row lg:items-center lg:gap-14 lg:pt-4">
      <div className="flex flex-col gap-5 sm:gap-6 lg:basis-[61.8%]">
        <h1 className="hero-in hero-in-1 max-w-[16ch] font-heading text-[2rem] font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
          Belajar Bahasa Inggris, tapi rasanya kayak main game.
        </h1>
        <p className="hero-in hero-in-2 max-w-[46ch] text-body-lg leading-7">
          Latihan pendek tiap hari, dari pilihan ganda sampai terjemahan. Salah
          dikit gak apa-apa, soalnya bakal muncul lagi sampai kamu hafal.
        </p>
        <div className="hero-in hero-in-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Link to="/login">
            <Button size="lg">Mulai belajar gratis</Button>
          </Link>
          <p className="text-body">Gratis, 10 menit sehari, bisa dari HP.</p>
        </div>
      </div>

      <div
        className="hero-in hero-in-4 mx-auto w-full max-w-[300px] sm:max-w-[380px] lg:mx-0 lg:max-w-[420px] lg:basis-[38.2%]"
        style={{ transform: `translateY(${parallaxY}px)` }}
      >
        <img
          src={illustration}
          alt="Maskot tunas hijau membawa buku, naik tangga batu"
          className="h-auto w-full -rotate-2 rounded-2xl border-2 border-[var(--color-text)] shadow-[5px_5px_0_var(--color-text)] sm:shadow-[8px_8px_0_var(--color-text)]"
        />
      </div>
    </section>
  );
};

export default HeroSection;