import { useEffect, useRef, useState } from "react";
import type { PathLesson } from "../../hooks/useDashboard";
import LessonNode from "./LessonNode";
import PathConnector from "./PathConnector";
import SunMarker from "./SunMarker";
import SunriseBackground from "./SunriseBackground";
import { getPathHeight, layoutPath, type PathOrientation } from "./pathLayout";

interface SunrisePathProps {
  lessons: PathLesson[];
  isComplete: boolean;
  orientation: PathOrientation;
  celebrateLessonId: string | null;
  onOpenLesson: (lessonId: string) => void;
  className?: string;
}

const stateText = { done: "Selesai", active: "Mulai", locked: "Terkunci" } as const;

const SunrisePath = ({
  lessons,
  isComplete,
  orientation,
  celebrateLessonId,
  onOpenLesson,
  className = "",
}: SunrisePathProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const count = lessons.length;
  const height = getPathHeight(count, orientation);
  const layout = width > 0 ? layoutPath(count, width, orientation) : null;
  const doneCount = lessons.filter((lesson) => lesson.state === "done").length;
  const progress = count > 0 ? doneCount / count : 0;
  const isVertical = orientation === "vertical";

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-[var(--color-text)] ${className}`}
      style={{ height }}
    >
      {layout && (
        <>
          <SunriseBackground width={width} height={height} sun={layout.sun} />
          <PathConnector
            width={width}
            height={height}
            points={layout.points}
            sun={layout.sun}
            doneCount={doneCount}
            orientation={orientation}
          />

          <div
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: layout.sun.x, top: layout.sun.y }}
          >
            <SunMarker size={isVertical ? 92 : 104} fill={progress} />
            <span className="whitespace-nowrap text-body-sm font-semibold text-[var(--color-bg)]">
              {isComplete ? "Unit selesai" : "Akhir unit"}
            </span>
          </div>

          <ol className="absolute inset-0 m-0 list-none p-0">
            {lessons.map((lesson, index) => {
              const point = layout.points[index];
              const tile = lesson.state === "active" ? layout.tile + 10 : layout.tile;
              const isLeftSide = isVertical && point.x < width / 2;
              // tablet: jarak antar node sempit, label dipendekin biar gak numpuk
              const longLabel = isVertical || layout.step >= 92;

              const labelStyle = isVertical
                ? {
                    top: point.y,
                    ...(isLeftSide
                      ? { left: point.x + tile / 2 + 12 }
                      : { right: width - point.x + tile / 2 + 12 }),
                  }
                : { left: point.x, top: point.y + tile / 2 + 12 };

              return (
                <li key={lesson.lesson_id}>
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: point.x, top: point.y }}
                  >
                    <LessonNode
                      state={lesson.state}
                      lessonNumber={lesson.number}
                      xp={lesson.xp_reward_base}
                      size={layout.tile}
                      surface="sky"
                      celebrate={celebrateLessonId === lesson.lesson_id}
                      onOpen={() => onOpenLesson(lesson.lesson_id)}
                    />
                  </div>
                  <div
                    aria-hidden="true"
                    style={labelStyle}
                    className={[
                      "pointer-events-none absolute whitespace-nowrap leading-tight text-[var(--color-bg-card)]",
                      isVertical
                        ? `-translate-y-1/2 ${isLeftSide ? "text-left" : "text-right"}`
                        : "-translate-x-1/2 text-center",
                      lesson.state === "locked" ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    <p className="font-heading text-body-lg font-bold">
                      {longLabel ? `Lesson ${lesson.number}` : lesson.number}
                    </p>
                    {(longLabel || lesson.state === "active") && (
                      <p
                        className={`text-body-sm ${
                          lesson.state === "active"
                            ? "font-semibold text-[var(--color-cta-soft)]"
                            : "text-[var(--color-bg-card)]/75"
                        }`}
                      >
                        {lesson.state === "active" && longLabel
                          ? `Mulai, +${lesson.xp_reward_base} XP`
                          : stateText[lesson.state]}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
};

export default SunrisePath;
