import { get, post } from "./client";
import type { AttemptResult, Progress, ReviewQueueItem } from "../types";

export const getMyProgress = () => get<Progress>("/progress/me");

// Cheat demo (+290 XP). Backend cuma ngaktifin ini di luar production.
export const claimCheatXp = () => post<Progress>("/progress/cheat-xp");

// Review queue = soal yang pernah salah, diulang sampai benar.
export const getReviewQueue = () => get<ReviewQueueItem[]>("/review/queue");

export const attemptReview = (reviewId: string, userAnswer: string) =>
  post<AttemptResult>("/review/attempt", {
    review_id: reviewId,
    user_answer: userAnswer,
  });
