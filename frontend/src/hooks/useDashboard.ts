import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "../api/client";
import { getCourses, getUnits } from "../api/lessonApi";
import { getMyProgress, getReviewQueue } from "../api/progressApi";
import { onProgressChanged } from "../utils/progressEvents";
import { toHeartSnapshot, type HeartSnapshot } from "./useHeartClock";
import type { LessonSummary, Progress, UnitWithLessons } from "../types";

export type LessonState = "done" | "active" | "locked";

export interface PathLesson extends LessonSummary {
  number: number; // urutan di dalam unit, mulai dari 1
  state: LessonState;
}

export interface PathUnit {
  unit_id: string;
  title: string;
  number: number;
  lessons: PathLesson[];
  doneCount: number;
  isComplete: boolean;
  isLocked: boolean;
}

export interface DashboardData {
  progress: Progress;
  // jadwal heart dari server, dihitung mundur sendiri di dashboard
  hearts: HeartSnapshot;
  courseTitle: string | null;
  units: PathUnit[];
  // Unit yang lagi dikerjain. Kalau semua sudah selesai: unit terakhir.
  focusUnit: PathUnit | null;
  // Lesson berikutnya yang bisa dikerjain, null kalau semua sudah selesai.
  nextLesson: PathLesson | null;
  // null = gagal diambil (dashboard tetap jalan tanpa angka ini)
  reviewCount: number | null;
}

type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardData };

const toPathUnits = (units: UnitWithLessons[]): PathUnit[] => {
  // Backend sudah ngitung locked/completed. "Aktif" = lesson pertama yang
  // belum selesai dan tidak terkunci, cuma boleh ada satu.
  let activeTaken = false;

  return [...units]
    .sort((a, b) => a.order_index - b.order_index)
    .map((unit, unitIndex) => {
      const lessons = [...unit.lessons]
        .sort((a, b) => a.order_index - b.order_index)
        .map((lesson, lessonIndex): PathLesson => {
          let state: LessonState = "locked";
          if (lesson.completed) {
            state = "done";
          } else if (!lesson.locked && !activeTaken) {
            state = "active";
            activeTaken = true;
          }
          return { ...lesson, number: lessonIndex + 1, state };
        });

      const doneCount = lessons.filter((l) => l.state === "done").length;
      return {
        unit_id: unit.unit_id,
        title: unit.title,
        number: unitIndex + 1,
        lessons,
        doneCount,
        isComplete: lessons.length > 0 && doneCount === lessons.length,
        isLocked: unit.locked,
      };
    });
};

const loadDashboard = async (): Promise<DashboardData> => {
  const [progress, courses] = await Promise.all([getMyProgress(), getCourses()]);
  const course = courses[0] ?? null;

  const [rawUnits, reviewCount] = await Promise.all([
    course ? getUnits(course.course_id) : Promise.resolve([]),
    getReviewQueue()
      .then((queue) => queue.length)
      .catch(() => null),
  ]);

  const units = toPathUnits(rawUnits);
  const activeUnit = units.find((unit) =>
    unit.lessons.some((lesson) => lesson.state === "active"),
  );
  const focusUnit = activeUnit ?? units[units.length - 1] ?? null;
  const nextLesson =
    activeUnit?.lessons.find((lesson) => lesson.state === "active") ?? null;

  return {
    progress,
    hearts: toHeartSnapshot(progress),
    courseTitle: course?.title ?? null,
    units,
    focusUnit,
    nextLesson,
    reviewCount,
  };
};

export const useDashboard = () => {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Progress berubah dari luar halaman (misal cheat XP): angka XP & badge langsung ikut.
  useEffect(
    () =>
      onProgressChanged((progress) =>
        setState((previous) =>
          previous.status === "ready"
            ? { status: "ready", data: { ...previous.data, progress } }
            : previous,
        ),
      ),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    loadDashboard()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ status: "error", message: getErrorMessage(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  return { state, retry };
};
