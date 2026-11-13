import { useCallback, useEffect, useState } from "react";
import { attemptStandard, attemptTranslate, completeLesson, getLesson } from "../api/lessonApi";
import { getErrorMessage } from "../api/client";
import { toHeartSnapshot, type HeartSnapshot } from "./useHeartClock";
import type { AttemptResult, Exercise, LessonCompleteResult, LessonDetail } from "../types";

interface LoadState {
  lessonId: string | undefined;
  lesson: LessonDetail | null;
  hearts: HeartSnapshot | null;
  error: string | null;
}

export const useLesson = (lessonId: string | undefined) => {
  const [loaded, setLoaded] = useState<LoadState>({
    lessonId: undefined,
    lesson: null,
    hearts: null,
    error: null,
  });

  useEffect(() => {
    if (!lessonId) return;
    let cancelled = false;
    getLesson(lessonId)
      .then((lesson) => {
        if (cancelled) return;
        setLoaded({ lessonId, lesson, hearts: toHeartSnapshot(lesson), error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoaded({ lessonId, lesson: null, hearts: null, error: getErrorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  // loading = belum ada hasil untuk lessonId yang sekarang
  const isLoading = Boolean(lessonId) && loaded.lessonId !== lessonId;
  const isCurrent = loaded.lessonId === lessonId;
  const lesson = isCurrent ? loaded.lesson : null;
  const hearts = isCurrent ? loaded.hearts : null;
  const error = !lessonId ? "Lesson tidak ditemukan" : isCurrent ? loaded.error : null;

  // Pilih endpoint sesuai tipe soal. Translate dinilai AI jadi bisa lebih lama.
  const submitAnswer = useCallback(
    async (exercise: Exercise, answer: string): Promise<AttemptResult> => {
      if (!lessonId) throw new Error("Lesson tidak ditemukan");
      const attempt = exercise.type === "translate" ? attemptTranslate : attemptStandard;
      return attempt(lessonId, exercise.exercise_id, answer);
    },
    [lessonId],
  );

  const finish = useCallback(async (): Promise<LessonCompleteResult> => {
    if (!lessonId) throw new Error("Lesson tidak ditemukan");
    return completeLesson(lessonId);
  }, [lessonId]);

  return { lesson, hearts, isLoading, error, submitAnswer, finish };
};
