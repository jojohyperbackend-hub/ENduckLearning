import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "../api/client";
import {
  attemptQuizQuestion,
  completeQuiz,
  generateQuiz,
  getQuizFormOptions,
} from "../api/quizApi";
import type {
  AttemptResult,
  QuizCompleteResult,
  QuizFormOptions,
  QuizFormRequest,
  QuizResult,
} from "../types";

export const useQuiz = () => {
  const [options, setOptions] = useState<QuizFormOptions | null>(null);
  const [quiz, setQuiz] = useState<QuizResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getQuizFormOptions()
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = useCallback(async (form: QuizFormRequest) => {
    setIsGenerating(true);
    setError(null);
    try {
      setQuiz(await generateQuiz(form));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const submitAnswer = useCallback(
    async (questionId: string, answer: string): Promise<AttemptResult> => {
      if (!quiz) throw new Error("Quiz belum dibuat");
      return attemptQuizQuestion(quiz.quiz_id, questionId, answer);
    },
    [quiz],
  );

  const finish = useCallback(async (): Promise<QuizCompleteResult> => {
    if (!quiz) throw new Error("Quiz belum dibuat");
    return completeQuiz(quiz.quiz_id);
  }, [quiz]);

  const reset = useCallback(() => setQuiz(null), []);

  return { options, quiz, isGenerating, error, generate, submitAnswer, finish, reset };
};
