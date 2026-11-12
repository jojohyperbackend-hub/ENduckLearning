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
