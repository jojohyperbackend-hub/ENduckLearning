import { useCallback, useEffect, useState } from "react";
import { attemptStandard, attemptTranslate, completeLesson, getLesson } from "../api/lessonApi";
import { getErrorMessage } from "../api/client";
import type {
  AttemptResult,
  Exercise,
  LessonCompleteResult,
  LessonDetail,
} from "../types";

interface LoadState {
  lessonId: string | undefined;
  lesson: LessonDetail | null;
  error: string | null;
}

export const useLesson = (lessonId: string | undefined) => {
  const [loaded, setLoaded] = useState<LoadState>({
    lessonId: undefined,
    lesson: null,
    error: null,
  });
  const [hearts, setHearts] = useState<number | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    let cancelled = false;
    getLesson(lessonId)
      .then((lesson) => {
        if (cancelled) return;
        setLoaded({ lessonId, lesson, error: null });
        setHearts(lesson.hearts_remaining);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoaded({ lessonId, lesson: null, error: getErrorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  // loading = belum ada hasil untuk lessonId yang sekarang
  const isLoading = Boolean(lessonId) && loaded.lessonId !== lessonId;
  const lesson = loaded.lessonId === lessonId ? loaded.lesson : null;
  const error = !lessonId
    ? "Lesson tidak ditemukan"
    : loaded.lessonId === lessonId
      ? loaded.error
      : null;

  // Pilih endpoint sesuai tipe soal. Translate dinilai AI jadi bisa lebih lama.
  const submitAnswer = useCallback(
    async (exercise: Exercise, answer: string): Promise<AttemptResult> => {
      if (!lessonId) throw new Error("Lesson tidak ditemukan");
      const attempt =
        exercise.type === "translate" ? attemptTranslate : attemptStandard;
      const result = await attempt(lessonId, exercise.exercise_id, answer);
      setHearts(result.hearts_remaining);
      return result;
    },
    [lessonId],
  );

  const finish = useCallback(async (): Promise<LessonCompleteResult> => {
    if (!lessonId) throw new Error("Lesson tidak ditemukan");
    const result = await completeLesson(lessonId);
    setHearts(result.hearts_remaining);
    return result;
  }, [lessonId]);

  return { lesson, isLoading, error, hearts, submitAnswer, finish };
};
