import { Check, Lock, Play } from "lucide-react";
import type { CSSProperties } from "react";
import type { LessonState } from "../../hooks/useDashboard";

interface LessonNodeProps {
  state: LessonState;
  lessonNumber: number;
  xp: number;
  size?: number;
  // "sky" = di atas panel Sunrise Path, "card" = di atas kartu krem
  surface?: "sky" | "card";
  // true sekali, pas lesson ini baru aja kebuka
  celebrate?: boolean;
  onOpen: () => void;
}

const CONFETTI = [
  { dx: -46, dy: -38, color: "#fff6ec" },
  { dx: -22, dy: -58, color: "#4c9a6b" },
  { dx: 6, dy: -64, color: "#fbe8d3" },
  { dx: 32, dy: -52, color: "#f85f73" },
  { dx: 52, dy: -28, color: "#fff6ec" },
  { dx: -56, dy: -8, color: "#f85f73" },
  { dx: 58, dy: 2, color: "#4c9a6b" },
  { dx: -34, dy: 26, color: "#fbe8d3" },
  { dx: 38, dy: 30, color: "#fff6ec" },
];

const stateLabel: Record<LessonState, string> = {
  done: "selesai, ketuk buat ngulang",
  active: "siap dikerjain",
  locked: "terkunci, selesaikan pelajaran sebelumnya dulu",
};

const LessonNode = ({
  state,
  lessonNumber,
  xp,
  size = 64,
  surface = "card",
  celebrate = false,
  onOpen,
}: LessonNodeProps) => {
  const isLocked = state === "locked";
  const dimension = state === "active" ? size + 10 : size;
  const iconSize = Math.round(dimension * 0.42);

  const tone = {
    done: "bg-[var(--color-correct)] text-white shadow-[0_5px_0_#37754f] hover:brightness-105",
    active:
      surface === "sky"
        ? "bg-[var(--color-cta)] text-[var(--color-text)] shadow-[0_6px_0_#b93a4f] hover:bg-[var(--color-cta-soft)]"
        : "bg-[var(--color-cta)] text-[var(--color-text)] border-2 border-[var(--color-text)] shadow-[0_6px_0_var(--color-text)] hover:bg-[var(--color-cta-soft)]",
    locked:
      surface === "sky"
        ? "border-2 border-dashed border-[#fbe8d3]/45 bg-[var(--color-text)] text-[#fbe8d3]/70"
        : "border-2 border-dashed border-[var(--color-text)]/20 bg-[var(--color-text)]/5 text-[var(--color-text)]/45",
  }[state];

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        disabled={isLocked}
        onClick={onOpen}
        data-active-node={state === "active" ? "" : undefined}
        aria-label={`Pelajaran ${lessonNumber}, ${stateLabel[state]}${isLocked ? "" : `, ${xp} XP`}`}
        title={isLocked ? "Selesaikan pelajaran sebelumnya dulu" : undefined}
        style={{ width: dimension, height: dimension } as CSSProperties}
        className={[
          "flex items-center justify-center rounded-[30%] transition-[transform,box-shadow,filter,background-color] duration-150",
          isLocked
            ? "cursor-not-allowed"
            : "cursor-pointer active:translate-y-[4px] active:shadow-none",
          state === "active" ? "node-bounce" : "",
          celebrate ? "node-pop" : "",
          tone,
        ].join(" ")}
      >
        {state === "done" && <Check size={iconSize} strokeWidth={3.2} />}
        {state === "active" && (
          <Play size={iconSize} strokeWidth={2.6} fill="currentColor" className="translate-x-[2px]" />
        )}
        {state === "locked" && <Lock size={iconSize - 2} strokeWidth={2.2} />}
      </button>

      {celebrate && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          {CONFETTI.map((piece, index) => (
            <span
              key={index}
              className="confetti-piece absolute left-1/2 top-1/2 h-2 w-2 rounded-[2px]"
              style={
                {
                  backgroundColor: piece.color,
                  "--dx": `${piece.dx}px`,
                  "--dy": `${piece.dy}px`,
                  animationDelay: `${index * 18}ms`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      )}
    </span>
  );
};

export default LessonNode;
