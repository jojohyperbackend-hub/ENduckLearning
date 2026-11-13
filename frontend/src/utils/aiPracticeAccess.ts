import { getQuizFormOptions } from "../api/quizApi";
import type { QuizFormOptions } from "../types";

export type AiPracticeLockReason = "gate1" | "xp";

export type AiPracticeAccess =
  | { status: "locked"; reason: AiPracticeLockReason; message: string }
  | { status: "open"; options: QuizFormOptions };

export const GATE1_FALLBACK_MESSAGE = "Selesaikan 1 lesson dulu buat buka Latihan AI";

// Poin Latihan AI. Latihan AI gak pakai heart: benar nambah XP, salah motong XP.
export const AI_XP_CORRECT = 14;
export const AI_XP_WRONG = 5;
// Syarat buka Latihan AI: total XP minimal segini (XP gak dipotong).
export const AI_MIN_XP = 10;

// Dicek pas tombol Latihan AI diklik, SEBELUM form muncul:
// Gerbang 1 (minimal 1 lesson selesai), lalu syarat minimal XP. Heart gak dicek.
export const checkAiPracticeAccess = async (): Promise<AiPracticeAccess> => {
  const options = await getQuizFormOptions();
  if (!options.gate1_passed) {
    return {
      status: "locked",
      reason: "gate1",
      message: options.gate1_message ?? GATE1_FALLBACK_MESSAGE,
    };
  }
  if (!options.xp_gate_passed) {
    return {
      status: "locked",
      reason: "xp",
      message:
        options.xp_gate_message ??
        `Butuh minimal ${options.xp_required} XP buat buka Latihan AI. XP kamu sekarang ${options.total_xp}.`,
    };
  }
  return { status: "open", options };
};
