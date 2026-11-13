const numberFormat = new Intl.NumberFormat("id-ID");

export const formatXp = (value: number): string =>
  `${numberFormat.format(value)} XP`;

export const formatStreak = (days: number): string => `${days} hari`;

export const formatAccuracy = (percent: number): string => `${Math.round(percent)}%`;

export const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

export const topicLabel = (topic: string): string =>
  topic.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// Label badge dari kriteria di backend (milestone_service: total_xp, current_streak).
export const badgeLabel = (criteriaType: string, criteriaValue: number): string => {
  const value = numberFormat.format(criteriaValue);
  if (criteriaType === "total_xp") return `${value} XP`;
  if (criteriaType === "current_streak") return `Streak ${value} hari`;
  return `${topicLabel(criteriaType)} ${value}`;
};

export const badgeHint = (criteriaType: string, criteriaValue: number): string => {
  const value = numberFormat.format(criteriaValue);
  if (criteriaType === "total_xp") return `Terkumpul ${value} XP`;
  if (criteriaType === "current_streak") return `Belajar ${value} hari berturut-turut`;
  return "Pencapaian baru";
};

export const exerciseTypeLabel = (type: "multiple_choice" | "fill_blank" | "translate"): string => {
  if (type === "multiple_choice") return "Pilih jawaban yang tepat";
  if (type === "fill_blank") return "Isi bagian yang kosong";
  return "Terjemahkan ke bahasa Inggris";
};
