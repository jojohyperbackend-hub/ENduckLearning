import { useEffect, useState } from "react";

interface CountUpProps {
  value: number;
  duration?: number;
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Angka naik dari 0 ke nilai akhir. Kalau user matiin animasi, langsung tampil.
const CountUp = ({ value, duration = 900, className = "" }: CountUpProps) => {
  const [reduced] = useState(prefersReducedMotion);
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  const shown = reduced ? value : animated;
  return (
    <span className={className} aria-label={value.toLocaleString("id-ID")}>
      <span aria-hidden="true">{shown.toLocaleString("id-ID")}</span>
    </span>
  );
};

export default CountUp;
