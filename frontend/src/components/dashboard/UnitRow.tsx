import { Lock } from "lucide-react";
import type { PathUnit } from "../../hooks/useDashboard";
import Card from "../common/Card";
import LessonNode from "./LessonNode";
import SunMarker from "./SunMarker";

interface UnitRowProps {
  unit: PathUnit;
  onOpenLesson: (lessonId: string) => void;
}

const stateText = { done: "Selesai", active: "Mulai", locked: "Terkunci" } as const;

// Unit yang lagi tidak dikerjain (sudah selesai atau masih terkunci):
// baris lesson datar di kartu krem, biar panel Sunrise Path tetap jadi fokus.
const UnitRow = ({ unit, onOpenLesson }: UnitRowProps) => {
  return (
    <Card className={`p-5 sm:p-7 ${unit.isLocked ? "opacity-80" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 className="font-heading text-card-header font-bold sm:text-2xl">
          Unit {unit.number}
          <span className="ml-2 font-body text-body font-normal text-[var(--color-text)]/75 sm:text-body-lg">
            {unit.title}
          </span>
        </h3>
        {unit.isComplete ? (
          <span className="flex items-center gap-1.5 text-body font-semibold text-[var(--color-correct)]">
            <SunMarker size={30} fill={1} tone="card" />
            Selesai
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-body text-[var(--color-text)]/70">
            <Lock size={14} />
            {unit.isLocked ? "Kebuka setelah unit sebelumnya selesai" : "Belum mulai"}
          </span>
        )}
      </div>

      {unit.lessons.length === 0 ? (
        <p className="mt-4 text-body text-[var(--color-text)]/70">
          Pelajaran buat unit ini belum ada.
        </p>
      ) : (
        <ol className="m-0 mt-5 grid list-none grid-cols-4 gap-x-2 gap-y-5 p-0 sm:grid-cols-6 lg:grid-cols-8">
          {unit.lessons.map((lesson) => (
            <li key={lesson.lesson_id} className="flex flex-col items-center gap-2 text-center">
              <LessonNode
                state={lesson.state}
                lessonNumber={lesson.number}
                xp={lesson.xp_reward_base}
                size={56}
                onOpen={() => onOpenLesson(lesson.lesson_id)}
              />
              <span aria-hidden="true" className="leading-tight">
                <span className="block font-heading text-body font-bold">
                  Pelajaran {lesson.number}
                </span>
                <span className="block text-caption text-[var(--color-text)]/70">
                  {stateText[lesson.state]}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
};

export default UnitRow;
