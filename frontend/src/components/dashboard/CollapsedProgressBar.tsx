import { ChevronDown, X } from "lucide-react";
import type { PathUnit } from "../../hooks/useDashboard";
import LessonSegments from "./LessonSegments";
import SunMarker from "./SunMarker";

interface CollapsedProgressBarProps {
  unit: PathUnit;
  isOpen: boolean;
  onToggle: () => void;
  panelId: string;
}

// Ringkasan Sunrise Path buat HP: satu bar, diketuk buat buka jalur penuh.
const CollapsedProgressBar = ({
  unit,
  isOpen,
  onToggle,
  panelId,
}: CollapsedProgressBarProps) => {
  const total = unit.lessons.length;
  const current = Math.min(unit.doneCount + 1, total);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={panelId}
      className="flex w-full cursor-pointer flex-col gap-3 p-5 text-left"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-3">
          <SunMarker size={46} fill={total > 0 ? unit.doneCount / total : 0} tone="card" />
          <span>
            <span className="block text-body-sm text-[var(--color-text)]/70">
              Unit {unit.number}
            </span>
            <span className="block font-heading text-card-header font-bold leading-tight">
              {unit.title}
            </span>
          </span>
        </span>
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-text)]/15 bg-[var(--color-bg)]"
        >
          {isOpen ? (
            <X size={18} />
          ) : (
            <ChevronDown size={18} />
          )}
        </span>
      </span>

      <LessonSegments lessons={unit.lessons} />

      <span className="flex items-center justify-between gap-3 text-body">
        <span className="font-semibold">
          {unit.isComplete
            ? `${total} lesson selesai`
            : `Lesson ${current} dari ${total}`}
        </span>
        <span className="text-[var(--color-text)]/70">
          {isOpen ? "Ketuk buat nutup" : "Ketuk buat lihat jalurnya"}
        </span>
      </span>
    </button>
  );
};

export default CollapsedProgressBar;
