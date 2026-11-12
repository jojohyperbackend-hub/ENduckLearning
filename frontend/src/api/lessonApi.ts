import { get, post } from "./client";
import type {
  AttemptResult,
  Course,
  LessonCompleteResult,
  LessonDetail,
  UnitWithLessons,
} from "../types";

export const getCourses = () => get<Course[]>("/courses");

export const getUnits = (courseId: string) =>
  get<UnitWithLessons[]>(`/units/${courseId}`);

export const getLesson = (lessonId: string) =>
  get<LessonDetail>(`/lessons/${lessonId}`);

// multiple_choice & fill_blank
export const attemptStandard = (
  lessonId: string,
  exerciseId: string,
  userAnswer: string,
) =>
  post<AttemptResult>(`/lessons/${lessonId}/attempt/standard`, {
    exercise_id: exerciseId,
    user_answer: userAnswer,
  });

// translate (dinilai AI, balikannya ada feedback & grammar_note)
export const attemptTranslate = (
  lessonId: string,
  exerciseId: string,
  userAnswer: string,
) =>
  post<AttemptResult>(`/lessons/${lessonId}/attempt/translate`, {
    exercise_id: exerciseId,
    user_answer: userAnswer,
  });

export const completeLesson = (lessonId: string) =>
  post<LessonCompleteResult>(`/lessons/${lessonId}/complete`);
