// Mirror dari backend app/models/schemas.py. UUID & datetime datang sebagai string.

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export type ExerciseType = "multiple_choice" | "fill_blank" | "translate";
export type QuizTypeOption = ExerciseType | "campur";
export type DifficultyOption =
  | "lebih_gampang"
  | "sama_kayak_terakhir"
  | "lebih_susah";
export type QuizStatus = "ready" | "partial";
export type QuestionSource = "ai_generated" | "fallback_original";

// ---------- Auth ----------
export interface AuthUser {
  user_id: string;
  email: string;
}

export interface RegisterPayload {
  email: string;
  password: string; // 8-72 karakter
}

export interface LoginPayload {
  email: string;
  password: string;
}

// ---------- Badge & progress ----------
export interface Badge {
  badge_id: string;
  criteria_type: string;
  criteria_value: number;
  earned_at: string;
}

export interface Progress {
  user_id: string;
  total_xp: number;
  current_streak: number;
  hearts_remaining: number;
  current_lesson_id: string | null;
  badges: Badge[];
}

// ---------- Course / unit / lesson ----------
export interface Course {
  course_id: string;
  title: string;
}

export interface LessonSummary {
  lesson_id: string;
  order_index: number;
  xp_reward_base: number;
  locked: boolean;
  completed: boolean;
}

export interface UnitWithLessons {
  unit_id: string;
  course_id: string;
  title: string;
  order_index: number;
  locked: boolean;
  lessons: LessonSummary[];
}

export interface Exercise {
  exercise_id: string;
  type: ExerciseType;
  topic: string;
  question: string;
  options: string[] | null;
}

export interface LessonDetail {
  lesson_id: string;
  unit_id: string;
  order_index: number;
  xp_reward_base: number;
  hearts_remaining: number;
  exercises: Exercise[];
}

export interface AttemptResult {
  correct: boolean;
  xp_earned: number;
  hearts_remaining: number;
  feedback: string | null; // hanya terisi untuk soal translate
  grammar_note: string | null;
}

export interface LessonCompleteResult {
  xp_earned_total: number;
  hearts_remaining: number;
  badge_earned: Badge | null;
}

// ---------- Review ----------
export interface ReviewQueueItem {
  review_id: string;
  exercise: Exercise | null;
  added_at: string;
}

// ---------- AI quiz ----------
export interface QuizFormRequest {
  jumlah_soal: number; // 3-10
  tipe_soal: QuizTypeOption;
  fokus_topik: string; // "auto" atau salah satu available_topics
  tingkat_kesulitan: DifficultyOption;
}

export interface QuizFormOptions {
  available_topics: string[];
  tipe_soal_options: QuizTypeOption[];
  tingkat_kesulitan_options: DifficultyOption[];
}

export interface QuizQuestion {
  question_id: string;
  type: ExerciseType;
  question_text: string;
  options: string[] | null;
  source: QuestionSource;
}

export interface QuizResult {
  quiz_id: string;
  status: QuizStatus;
  total_soal: number;
  estimasi_xp: number;
  generated_at: string;
  questions: QuizQuestion[];
}

export interface QuizCompleteResult {
  quiz_id: string;
  total_soal: number;
  jumlah_benar: number;
  jumlah_salah: number;
  akurasi: number;
  total_xp_earned: number;
  hearts_remaining: number;
  badge_earned: Badge | null;
}

// ---------- Sesi di frontend ----------
// Backend gak punya /auth/me, jadi setelah reload cuma user_id (dari /progress/me)
// yang diketahui; email baru ada kalau barusan login/register.
export interface SessionUser {
  user_id: string;
  email: string | null;
}

export type AuthStatus = "loading" | "authenticated" | "guest";

export type RegisterOutcome = "logged_in" | "needs_login";
