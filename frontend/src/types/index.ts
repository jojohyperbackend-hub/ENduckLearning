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

// ---------- Heart ----------
// Sisa detik sampai tiap heart yang hilang balik (urut dari yang paling cepat).
// Dihitung server pakai jam UTC; frontend cuma hitung mundur sendiri.
export interface HeartState {
  hearts_remaining: number;
  heart_max: number;
  heart_regen_in_seconds: number[];
  next_heart_in_seconds: number | null;
}

// ---------- Badge & progress ----------
export interface Badge {
  badge_id: string;
  // Dari tabel badge (migration 005). Bisa null kalau migration belum dijalanin.
  name?: string | null;
  code?: string | null;
  criteria_type: string;
  criteria_value: number;
  earned_at: string;
}

export interface Progress extends HeartState {
  user_id: string;
  total_xp: number;
  current_streak: number;
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

export interface LessonDetail extends HeartState {
  lesson_id: string;
  unit_id: string;
  order_index: number;
  xp_reward_base: number;
  exercises: Exercise[];
}

export interface AttemptResult extends HeartState {
  correct: boolean;
  xp_earned: number;
  feedback: string | null; // hanya terisi untuk soal translate
  grammar_note: string | null;
}

export interface LessonCompleteResult extends HeartState {
  xp_earned_total: number;
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

export interface QuizFormOptions extends HeartState {
  // Gerbang 1: minimal 1 lesson pernah selesai
  gate1_passed: boolean;
  gate1_message: string | null;
  // Syarat minimal XP buat buka Latihan AI (dicek setelah Gerbang 1)
  xp_required: number;
  total_xp: number;
  xp_gate_passed: boolean;
  xp_gate_message: string | null;
  // Topik manual, cuma dari unit yang sudah terbuka
  available_topics: string[];
  tipe_soal_options: QuizTypeOption[];
  tingkat_kesulitan_options: DifficultyOption[];
}

export interface QuizQuestion {
  question_id: string;
  type: ExerciseType;
  topic: string;
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

export interface QuizCompleteResult extends HeartState {
  quiz_id: string;
  total_soal: number;
  jumlah_benar: number;
  jumlah_salah: number;
  akurasi: number;
  total_xp_earned: number;
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
