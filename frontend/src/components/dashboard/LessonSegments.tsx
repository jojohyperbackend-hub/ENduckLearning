import type { PathLesson } from "../../hooks/useDashboard";

interface LessonSegmentsProps {
  lessons: PathLesson[];
  className?: string;
}

const segmentColor = {
  done: "bg-[var(--color-correct)]",
  active: "bg-[var(--color-cta)]",
  locked: "bg-[var(--color-text)]/12",
} as const;

// Progres unit, satu ruas per lesson: hijau selesai, pink yang lagi aktif.
const LessonSegments = ({ lessons, className = "" }: LessonSegmentsProps) => {
  const doneCount = lessons.filter((lesson) => lesson.state === "done").length;

  return (
    <div
      role="img"
      aria-label={`${doneCount} dari ${lessons.length} pelajaran selesai`}
      className={`flex gap-1.5 ${className}`}
    >
      {lessons.map((lesson) => (
        <span
          key={lesson.lesson_id}
          className={`h-3 flex-1 rounded-full transition-colors duration-500 ${segmentColor[lesson.state]}`}
        />
      ))}
    </div>
  );
};

export default LessonSegments;
