import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Heart, HeartCrack } from "lucide-react";
import {
  formatClockTime,
  formatCountdown,
  useHeartClock,
  type HeartSnapshot,
} from "../../hooks/useHeartClock";

interface HeartsEmptyModalProps {
  snapshot: HeartSnapshot;
  // Satu-satunya aksi: balik ke dashboard (atau tutup kalau sudah di dashboard)
  onConfirm: () => void;
}

// Popup yang sama persis dipakai pas mau mulai (Titik A) dan pas heart abis di tengah soal (Titik B).
const HeartsEmptyModal = ({ snapshot, onConfirm }: HeartsEmptyModalProps) => {
  const clock = useHeartClock(snapshot);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    buttonRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onConfirm();
      }
      // Cuma ada satu tombol, fokus dikunci di situ
      if (event.key === "Tab") {
        event.preventDefault();
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onConfirm]);

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[var(--color-text)]/70 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="modal-pop w-full max-w-sm rounded-3xl border-2 border-[var(--color-text)] bg-[var(--color-bg-card)] p-6 text-center shadow-[8px_8px_0_var(--color-cta)] sm:p-7"
      >
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-[var(--color-text)] bg-[var(--color-cta)]">
          <HeartCrack size={30} aria-hidden="true" />
        </span>

        <h2 id={titleId} className="mt-4 font-heading text-[2rem] font-extrabold leading-none">
          Heart habis
        </h2>
        <p id={descriptionId} className="mx-auto mt-2 max-w-[30ch] text-body-lg">
          Tunggu heart kamu terisi lagi, atau balik lagi nanti.
        </p>

        <div
          role="img"
          aria-label={`${clock.hearts} dari ${clock.max} heart`}
          className="mt-5 flex justify-center gap-1"
        >
          {Array.from({ length: clock.max }, (_, index) => (
            <Heart
              key={index}
              size={26}
              aria-hidden="true"
              className={`transition-colors duration-300 ${
                index < clock.hearts
                  ? "fill-[var(--color-cta)] text-[var(--color-cta)]"
                  : "text-[var(--color-text)]/25"
              }`}
            />
          ))}
        </div>

        <div className="mt-4 rounded-2xl border-2 border-[var(--color-text)]/15 bg-[var(--color-bg)] px-4 py-3">
          {clock.nextIn !== null ? (
            <>
              <p className="text-body-sm font-semibold">Heart berikutnya dalam</p>
              <p
                className="font-heading text-5xl font-extrabold leading-tight tabular-nums"
                aria-label={`${formatCountdown(clock.nextIn)} menit`}
              >
                {formatCountdown(clock.nextIn)}
              </p>
              {clock.fullAt !== null && (
                <p className="text-body-sm">
                  Penuh lagi sekitar pukul {formatClockTime(clock.fullAt)}
                </p>
              )}
            </>
          ) : (
            <p className="py-2 text-body">
              {clock.hearts > 0
                ? "Heart kamu sudah terisi lagi."
                : "Jadwal heart lagi dihitung. Coba lagi beberapa menit lagi."}
            </p>
          )}
        </div>

        <button
          ref={buttonRef}
          type="button"
          onClick={onConfirm}
          className="mt-5 w-full cursor-pointer rounded-full border border-[var(--color-text)]/70 bg-[var(--color-cta)] px-6 py-3 text-base font-bold text-[var(--color-text)] shadow-[0_4px_0_rgba(40,60,99,0.8)] transition hover:bg-[var(--color-cta-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-text)] active:translate-y-0.5 active:shadow-[0_2px_0_rgba(40,60,99,0.8)]"
        >
          Oke, balik ke dashboard
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default HeartsEmptyModal;
