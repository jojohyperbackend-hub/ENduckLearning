import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "../api/client";
import { getCourses, getUnits } from "../api/lessonApi";
import { getMyProgress, getReviewQueue } from "../api/progressApi";
import { onProgressChanged } from "../utils/progressEvents";
import { toHeartSnapshot, type HeartSnapshot } from "./useHeartClock";
import type { Progress, ReviewQueueItem, UnitWithLessons } from "../types";

export interface ProgressPageData {
  progress: Progress;
  hearts: HeartSnapshot;
  courseTitle: string | null;
  // null = gagal diambil, halamannya tetap jalan tanpa bagian ini
  units: UnitWithLessons[] | null;
  reviewItems: ReviewQueueItem[] | null;
}

type ProgressPageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ProgressPageData };

const loadUnits = async () => {
  const courses = await getCourses();
  const course = courses[0] ?? null;
  const units = course ? await getUnits(course.course_id) : [];
  return {
    courseTitle: course?.title ?? null,
    units: [...units].sort((a, b) => a.order_index - b.order_index),
  };
};

const loadProgressPage = async (): Promise<ProgressPageData> => {
  const [progress, unitsResult, reviewItems] = await Promise.all([
    getMyProgress(),
    loadUnits().catch(() => null),
    getReviewQueue().catch(() => null),
  ]);

  return {
    progress,
    hearts: toHeartSnapshot(progress),
    courseTitle: unitsResult?.courseTitle ?? null,
    units: unitsResult?.units ?? null,
    reviewItems,
  };
};

export const useProgressPage = () => {
  const [state, setState] = useState<ProgressPageState>({ status: "loading" });
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
    loadProgressPage()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", message: getErrorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  // Update lokal habis jawab soal Review, tanpa muat ulang seluruh halaman.
  const patch = useCallback((updater: (data: ProgressPageData) => ProgressPageData) => {
    setState((current) =>
      current.status === "ready" ? { status: "ready", data: updater(current.data) } : current,
    );
  }, []);

  return { state, retry, patch };
};
