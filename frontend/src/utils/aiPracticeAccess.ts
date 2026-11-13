import { getQuizFormOptions } from "../api/quizApi";
import { toHeartSnapshot, type HeartSnapshot } from "../hooks/useHeartClock";
import type { QuizFormOptions } from "../types";

export type AiPracticeAccess =
  | { status: "locked"; message: string }
  | { status: "no-hearts"; hearts: HeartSnapshot }
  | { status: "open"; options: QuizFormOptions; hearts: HeartSnapshot };

export const GATE1_FALLBACK_MESSAGE = "Selesaikan 1 lesson dulu buat buka Latihan AI";

// Dicek pas tombol Latihan AI diklik, SEBELUM form muncul:
// Gerbang 1 (minimal 1 lesson selesai), lalu heart (Titik A).
export const checkAiPracticeAccess = async (): Promise<AiPracticeAccess> => {
  const options = await getQuizFormOptions();
  if (!options.gate1_passed) {
    return { status: "locked", message: options.gate1_message ?? GATE1_FALLBACK_MESSAGE };
  }
  const hearts = toHeartSnapshot(options);
  if (options.hearts_remaining <= 0) {
    return { status: "no-hearts", hearts };
  }
  return { status: "open", options, hearts };
};
