import { useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

// posisi & gerakan sekarang diacak di runtime, jadi cuma butuh teks + ukuran
const words = [
  { text: "goes", size: "text-5xl" },
  { text: "-ed", size: "text-6xl" },
  { text: "the", size: "text-4xl" },
  { text: "is / are", size: "text-5xl" },
  { text: "have been", size: "text-4xl" },
  { text: "?", size: "text-7xl" },
  { text: "will", size: "text-5xl" },
  { text: "was / were", size: "text-4xl" },
  { text: "a / an", size: "text-6xl" },
  { text: "-ing", size: "text-5xl" },
  { text: "in / on / at", size: "text-4xl" },
  { text: "don't", size: "text-5xl" },
  { text: "she + s", size: "text-5xl" },
  { text: "can", size: "text-6xl" },
  { text: "did", size: "text-4xl" },
  { text: "!", size: "text-7xl" },
  { text: "to + V1", size: "text-4xl" },
  { text: "yesterday", size: "text-4xl" },
  { text: "every day", size: "text-3xl" },
  { text: "never", size: "text-3xl" },
];

interface Item {
  el: HTMLSpanElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
}

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const randSign = () => (Math.random() < 0.5 ? -1 : 1);

export function FloatingWords() {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let bounds = { w: container.clientWidth, h: container.clientHeight };

    const items: Item[] = spanRefs.current
      .filter((el): el is HTMLSpanElement => el !== null)
      .map((el) => ({
        el,
        x: 0,
        y: 0,
        // kecepatan px/detik, dibikin gak terlalu lurus horizontal/vertikal
        vx: randSign() * rand(20, 50),
        vy: randSign() * rand(20, 50),
        w: el.offsetWidth,
        h: el.offsetHeight,
        rot: rand(-8, 8),
      }));

    const place = (it: Item) => {
      it.el.style.transform = `translate3d(${it.x}px, ${it.y}px, 0) rotate(${it.rot}deg)`;
    };

    // posisi awal acak
    items.forEach((it) => {
      it.x = rand(0, Math.max(0, bounds.w - it.w));
      it.y = rand(0, Math.max(0, bounds.h - it.h));
      place(it);
    });

    // update ukuran pas viewport berubah (atau font baru kelar load)
    const ro = new ResizeObserver(() => {
      bounds = { w: container.clientWidth, h: container.clientHeight };
      items.forEach((it) => {
        it.w = it.el.offsetWidth;
        it.h = it.el.offsetHeight;
        it.x = Math.min(it.x, Math.max(0, bounds.w - it.w));
        it.y = Math.min(it.y, Math.max(0, bounds.h - it.h));
        place(it);
      });
    });
    ro.observe(container);

    // user minta reduced motion: cukup diam di posisi acak
    if (reduceMotion) return () => ro.disconnect();

    let rafId = 0;
    let last = performance.now();

    const tick = (now: number) => {
      // clamp dt biar gak loncat jauh abis tab di-background
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (bounds.w > 0) {
        for (const it of items) {
          it.x += it.vx * dt;
          it.y += it.vy * dt;

          const maxX = Math.max(0, bounds.w - it.w);
          const maxY = Math.max(0, bounds.h - it.h);

          if (it.x <= 0) {
            it.x = 0;
            it.vx = Math.abs(it.vx);
          } else if (it.x >= maxX) {
            it.x = maxX;
            it.vx = -Math.abs(it.vx);
          }

          if (it.y <= 0) {
            it.y = 0;
            it.vy = Math.abs(it.vy);
          } else if (it.y >= maxY) {
            it.y = maxY;
            it.vy = -Math.abs(it.vy);
          }

          place(it);
        }
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [reduceMotion]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden md:block"
    >
      {words.map((w, i) => (
        <span
          key={w.text}
          ref={(el) => {
            spanRefs.current[i] = el;
          }}
          className={`absolute left-0 top-0 select-none whitespace-nowrap font-bold text-[#263a63]/10 will-change-transform ${w.size}`}
        >
          {w.text}
        </span>
      ))}
    </div>
  );
}