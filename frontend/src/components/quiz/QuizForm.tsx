import { useId, useState } from "react";
import { Sparkles } from "lucide-react";
import Button from "../common/Button";
import Card from "../common/Card";
import ChoiceGroup, { type Choice } from "./ChoiceGroup";
import { topicLabel } from "../../utils/formatters";
import type { DifficultyOption, QuizFormRequest, QuizTypeOption } from "../../types";

const XP_PER_SOAL = 10;

type FocusMode = "auto" | "manual";

const FOCUS_CHOICES = (hasTopics: boolean): Choice<FocusMode>[] => [
  { value: "auto", label: "Otomatis", hint: "AI pilih topik yang paling sering kamu salahin" },
  {
    value: "manual",
    label: "Pilih sendiri",
    hint: hasTopics ? "Dari unit yang sudah kebuka" : "Belum ada topik yang kebuka",
    disabled: !hasTopics,
  },
];

const TYPE_CHOICES: Choice<QuizTypeOption>[] = [
  { value: "campur", label: "Campur" },
  { value: "multiple_choice", label: "Pilihan ganda" },
  { value: "fill_blank", label: "Isi kosong" },
  { value: "translate", label: "Terjemahan" },
];

const COUNT_CHOICES: Choice<string>[] = ["3", "5", "7", "10"].map((value) => ({
  value,
  label: `${value} soal`,
}));

const DIFFICULTY_CHOICES: Choice<DifficultyOption>[] = [
  { value: "lebih_gampang", label: "Lebih gampang" },
  { value: "sama_kayak_terakhir", label: "Sama kayak terakhir" },
  { value: "lebih_susah", label: "Lebih susah" },
];

interface QuizFormProps {
  topics: string[];
  isSubmitting: boolean;
  error: string | null;
  initial: QuizFormRequest | null;
  onSubmit: (form: QuizFormRequest) => void;
}

const QuizForm = ({ topics, isSubmitting, error, initial, onSubmit }: QuizFormProps) => {
  const selectId = useId();
  const initialManual = initial && initial.fokus_topik !== "auto" && topics.includes(initial.fokus_topik);
  const [focusMode, setFocusMode] = useState<FocusMode>(initialManual ? "manual" : "auto");
  const [topic, setTopic] = useState<string>(
    initialManual ? (initial?.fokus_topik ?? topics[0] ?? "") : (topics[0] ?? ""),
  );
  const [tipeSoal, setTipeSoal] = useState<QuizTypeOption>(initial?.tipe_soal ?? "campur");
  const [jumlahSoal, setJumlahSoal] = useState<string>(String(initial?.jumlah_soal ?? 5));
  const [difficulty, setDifficulty] = useState<DifficultyOption>(
    initial?.tingkat_kesulitan ?? "sama_kayak_terakhir",
  );

  const count = Number(jumlahSoal);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    onSubmit({
      jumlah_soal: count,
      tipe_soal: tipeSoal,
      fokus_topik: focusMode === "auto" ? "auto" : topic,
      tingkat_kesulitan: difficulty,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card className="flex flex-col gap-7 border-2 border-[var(--color-text)] p-5 shadow-[8px_8px_0_var(--color-cta)] sm:p-8">
        <div className="flex flex-col gap-3">
          <ChoiceGroup
            legend="Fokus topik"
            name="fokus"
            variant="cards"
            choices={FOCUS_CHOICES(topics.length > 0)}
            value={focusMode}
            onChange={setFocusMode}
          />
          {focusMode === "manual" && (
            <div>
              <label htmlFor={selectId} className="sr-only">
                Topik
              </label>
              <select
                id={selectId}
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="w-full cursor-pointer rounded-2xl border-2 border-[var(--color-text)] bg-white px-4 py-3 text-body-lg text-[var(--color-text)] outline-none focus:border-[var(--color-cta)]"
              >
                {topics.map((option) => (
                  <option key={option} value={option}>
                    {topicLabel(option)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <ChoiceGroup
          legend="Tipe soal"
          name="tipe"
          choices={TYPE_CHOICES}
          value={tipeSoal}
          onChange={setTipeSoal}
        />

        <ChoiceGroup
          legend="Jumlah soal"
          name="jumlah"
          choices={COUNT_CHOICES}
          value={jumlahSoal}
          onChange={setJumlahSoal}
        />

        <ChoiceGroup
          legend="Tingkat kesulitan"
          name="kesulitan"
          choices={DIFFICULTY_CHOICES}
          value={difficulty}
          onChange={setDifficulty}
        />

        <div className="flex flex-col gap-3 border-t-2 border-[var(--color-text)]/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-lg">
            Sampai <span className="font-heading font-extrabold">+{count * XP_PER_SOAL} XP</span>{" "}
            kalau semua benar. Jawaban salah ngurangin 1 heart.
          </p>
          <div className="shrink-0 [&>button]:w-full sm:[&>button]:w-auto">
            <Button
              type="submit"
              icon={Sparkles}
              isLoading={isSubmitting}
              loadingText="Mengirim..."
            >
              Buat soal
            </Button>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="-mt-3 rounded-2xl border-2 border-[var(--color-wrong)] bg-[#f9d9d4] px-4 py-3 text-body font-semibold"
          >
            {error}
          </p>
        )}
      </Card>
    </form>
  );
};

export default QuizForm;
