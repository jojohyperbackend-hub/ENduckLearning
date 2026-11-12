import { get, post } from "./client";
import type {
  AttemptResult,
  QuizCompleteResult,
  QuizFormOptions,
  QuizFormRequest,
  QuizResult,
} from "../types";

export const getQuizFormOptions = () =>
  get<QuizFormOptions>("/ai/quiz/form-options");

export const generateQuiz = (form: QuizFormRequest) =>
  post<QuizResult>("/ai/practice/generate", form);

export const attemptQuizQuestion = (
  quizId: string,
  questionId: string,
  userAnswer: string,
) =>
  post<AttemptResult>(`/ai/quiz/${quizId}/attempt`, {
    question_id: questionId,
    user_answer: userAnswer,
  });

export const completeQuiz = (quizId: string) =>
  post<QuizCompleteResult>(`/ai/quiz/${quizId}/complete`);
