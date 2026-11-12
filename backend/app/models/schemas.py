from datetime import datetime
from typing import Generic, List, Literal, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

DataT = TypeVar("DataT")

TipeSoalLiteral = Literal["multiple_choice", "fill_blank", "translate", "campur"]
TipeSoalConcreteLiteral = Literal["multiple_choice", "fill_blank", "translate"]
TingkatKesulitanLiteral = Literal["lebih_gampang", "sama_kayak_terakhir", "lebih_susah"]
SourceTypeLiteral = Literal["lesson", "ai_quiz"]
QuestionSourceLiteral = Literal["ai_generated", "fallback_original"]
QuizStatusLiteral = Literal["ready", "partial"]
PipelineLiteral = Literal["practice_generator", "translate_feedback"]
RejectionReasonCategory = Literal[
    "ai_error_teknis",
    "placeholder_terdeteksi",
    "format_tidak_valid",
    "jawaban_tidak_masuk_akal",
    "duplikat_soal",
    "grounding_gagal",
]


class ApiResponse(BaseModel, Generic[DataT]):
    success: bool
    data: Optional[DataT] = None
    error: Optional[str] = None

    @model_validator(mode="after")
    def validate_envelope_consistency(self) -> "ApiResponse[DataT]":
        if self.success:
            if self.error is not None:
                raise ValueError("error wajib null kalau success true")
        else:
            if self.data is not None:
                raise ValueError("data wajib null kalau success false")
            if self.error is None or self.error.strip() == "":
                raise ValueError("error wajib diisi pesan jelas kalau success false")
        return self


class GoogleCallbackRequest(BaseModel):
    supabase_access_token: str = Field(..., min_length=1)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=72)


class AuthUserData(BaseModel):
    user_id: UUID
    email: str


class BadgeOut(BaseModel):
    badge_id: UUID
    criteria_type: str
    criteria_value: int
    earned_at: datetime


class CourseOut(BaseModel):
    course_id: UUID
    title: str


class LessonSummaryOut(BaseModel):
    lesson_id: UUID
    order_index: int
    xp_reward_base: int
    locked: bool
    completed: bool


class UnitWithLessonsOut(BaseModel):
    unit_id: UUID
    course_id: UUID
    title: str
    order_index: int
    locked: bool
    lessons: List[LessonSummaryOut]


class ExercisePublicOut(BaseModel):
    exercise_id: UUID
    type: TipeSoalConcreteLiteral
    topic: str
    question: str
    options: Optional[List[str]] = None


class LessonDetailOut(BaseModel):
    lesson_id: UUID
    unit_id: UUID
    order_index: int
    xp_reward_base: int
    hearts_remaining: int
    exercises: List[ExercisePublicOut]


class AttemptStandardRequest(BaseModel):
    exercise_id: UUID
    user_answer: str = Field(..., min_length=1)


class AttemptTranslateRequest(BaseModel):
    exercise_id: UUID
    user_answer: str = Field(..., min_length=1)


class AttemptResultOut(BaseModel):
    correct: bool
    xp_earned: int
    hearts_remaining: int
    feedback: Optional[str] = None
    grammar_note: Optional[str] = None


class LessonCompleteResultOut(BaseModel):
    xp_earned_total: int
    hearts_remaining: int
    badge_earned: Optional[BadgeOut] = None


class ProgressOut(BaseModel):
    user_id: UUID
    total_xp: int
    current_streak: int
    hearts_remaining: int
    current_lesson_id: Optional[UUID] = None
    badges: List[BadgeOut] = Field(default_factory=list)


class ReviewQueueItemOut(BaseModel):
    review_id: UUID
    exercise: Optional[ExercisePublicOut] = None
    added_at: datetime


class ReviewAttemptRequest(BaseModel):
    review_id: UUID
    user_answer: str = Field(..., min_length=1)


class QuizFormRequest(BaseModel):
    jumlah_soal: int = Field(default=5, ge=3, le=10)
    tipe_soal: TipeSoalLiteral = "campur"
    fokus_topik: str = "auto"
    tingkat_kesulitan: TingkatKesulitanLiteral = "sama_kayak_terakhir"


class QuizFormOptionsOut(BaseModel):
    available_topics: List[str]
    tipe_soal_options: List[str] = Field(
        default_factory=lambda: ["multiple_choice", "fill_blank", "translate", "campur"]
    )
    tingkat_kesulitan_options: List[str] = Field(
        default_factory=lambda: ["lebih_gampang", "sama_kayak_terakhir", "lebih_susah"]
    )


class QuizQuestionItemOut(BaseModel):
    question_id: UUID
    type: TipeSoalConcreteLiteral
    question_text: str
    options: Optional[List[str]] = None
    source: QuestionSourceLiteral


class QuizResultOut(BaseModel):
    quiz_id: UUID
    status: QuizStatusLiteral
    total_soal: int
    estimasi_xp: int
    generated_at: datetime
    questions: List[QuizQuestionItemOut]


class QuizAttemptRequest(BaseModel):
    question_id: UUID
    user_answer: str = Field(..., min_length=1)


class QuizCompleteResultOut(BaseModel):
    quiz_id: UUID
    total_soal: int
    jumlah_benar: int
    jumlah_salah: int
    akurasi: int
    total_xp_earned: int
    hearts_remaining: int
    badge_earned: Optional[BadgeOut] = None


class PracticeGeneratorAiOutput(BaseModel):
    type: TipeSoalConcreteLiteral
    question: str = Field(..., min_length=5, max_length=200)
    options: Optional[List[str]] = None
    expected_answer: str = Field(..., min_length=1)
    based_on_pattern: str = Field(..., min_length=5)

    @model_validator(mode="after")
    def validate_contract(self) -> "PracticeGeneratorAiOutput":
        if self.type == "multiple_choice":
            if self.options is None or not (2 <= len(self.options) <= 4):
                raise ValueError("options wajib berisi 2-4 item kalau type multiple_choice")
        else:
            if self.options is not None:
                raise ValueError("options wajib null kalau type bukan multiple_choice")
        if self.expected_answer.strip() == self.question.strip():
            raise ValueError("expected_answer tidak boleh sama persis dengan question")
        return self


class TranslateFeedbackAiOutput(BaseModel):
    is_meaning_correct: bool
    feedback: str = Field(..., min_length=5, max_length=200)
    grammar_note: Optional[str] = None

    @field_validator("grammar_note")
    @classmethod
    def validate_grammar_note(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value.strip() == "":
            raise ValueError("grammar_note tidak boleh string kosong, pakai null kalau tidak ada catatan")
        return value


class TopicScoreDetail(BaseModel):
    topic: str
    jumlah_total_dicoba: int
    jumlah_salah: int
    wilson_lower: float
    recency_score: float
    repeat_score: float
    skor_topik: float
    is_weak: bool


class AiCallLogEntry(BaseModel):
    pipeline: PipelineLiteral
    percobaan_ke: int = Field(..., ge=1, le=4)
    berhasil: bool
    alasan_gagal: Optional[RejectionReasonCategory] = None
    token_used: int = Field(..., ge=0)
    temperature_used: float = Field(..., ge=0.0, le=0.2)
    lama_proses_ms: int = Field(..., ge=0)

    @model_validator(mode="after")
    def validate_alasan_gagal_consistency(self) -> "AiCallLogEntry":
        if self.berhasil and self.alasan_gagal is not None:
            raise ValueError("alasan_gagal wajib null kalau berhasil true")
        if not self.berhasil and self.alasan_gagal is None:
            raise ValueError("alasan_gagal wajib diisi kalau berhasil false")
        return self
