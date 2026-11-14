import type { Badge } from "../types";
import { badgeHint, badgeLabel } from "./formatters";

// Tampilan badge di frontend. Syarat aslinya tetap dihitung backend (tabel badge),
// di sini cuma nama, ikon, warna, dan ukuran tile di galeri.
export type BadgeTone = "ink" | "pink" | "green" | "cream";
export type BadgeIconKey = "crown" | "medal" | "target" | "heart-crack" | "flame" | "star";
export type BadgeTileSize = "hero" | "wide" | "small";

export interface BadgeCatalogEntry {
  code: string;
  name: string;
  criteriaType: string;
  criteriaValue: number;
  requires?: string;
  icon: BadgeIconKey;
  tone: BadgeTone;
  size: BadgeTileSize;
  howTo: string;
  earnedLine: string;
}

export const BADGE_CATALOG: BadgeCatalogEntry[] = [
  {
    code: "sang_juara",
    name: "Sang Juara",
    criteriaType: "total_xp",
    criteriaValue: 1800,
    requires: "calon_juara",
    icon: "crown",
    tone: "ink",
    size: "hero",
    howTo: "Tembus 1.800 XP setelah jadi Calon Juara.",
    earnedLine: "1.800 XP terkumpul. Puncak klasemen kamu sendiri.",
  },
  {
    code: "calon_juara",
    name: "Calon Juara",
    criteriaType: "total_xp",
    criteriaValue: 450,
    icon: "medal",
    tone: "pink",
    size: "wide",
    howTo: "Kumpulin 450 XP dari lesson, Latihan AI, atau Review.",
    earnedLine: "450 XP terkumpul. Tinggal satu tangga lagi.",
  },
  {
    code: "cie_udah_compe_nih",
    name: "Mulai Serius Nih",
    criteriaType: "lesson_correct_streak",
    criteriaValue: 4,
    icon: "target",
    tone: "green",
    size: "small",
    howTo: "Jawab bener 4x berturut-turut di lesson.",
    earnedLine: "4 jawaban bener tanpa putus.",
  },
  {
    code: "miss_mulu",
    name: "Miss Mulu",
    criteriaType: "lesson_wrong_streak",
    criteriaValue: 6,
    icon: "heart-crack",
    tone: "cream",
    size: "small",
    howTo: "Salah 6x berturut-turut di lesson.",
    earnedLine: "6x meleset beruntun. Namanya juga belajar.",
  },
];

const catalogByCode = new Map(BADGE_CATALOG.map((entry) => [entry.code, entry]));

/** Cocokin badge dari backend ke katalog: pakai code, kalau kosong pakai syaratnya. */
export const findCatalogEntry = (badge: Badge): BadgeCatalogEntry | undefined => {
  if (badge.code && catalogByCode.has(badge.code)) return catalogByCode.get(badge.code);
  return BADGE_CATALOG.find(
    (entry) =>
      entry.criteriaType === badge.criteria_type && entry.criteriaValue === badge.criteria_value,
  );
};

export const badgeTitle = (badge: Badge): string =>
  badge.name || findCatalogEntry(badge)?.name || badgeLabel(badge.criteria_type, badge.criteria_value);

export const badgeDescription = (badge: Badge): string =>
  findCatalogEntry(badge)?.earnedLine ?? badgeHint(badge.criteria_type, badge.criteria_value);

export const badgeIconKey = (badge: Badge): BadgeIconKey => {
  const entry = findCatalogEntry(badge);
  if (entry) return entry.icon;
  return badge.criteria_type === "current_streak" ? "flame" : "star";
};

export type CatalogTile = { entry: BadgeCatalogEntry; earned: Badge | undefined };

/** Gabungin katalog dengan badge milik user. Badge di luar katalog jadi tile tambahan. */
export const badgeCollection = (badges: Badge[]) => {
  const tiles: CatalogTile[] = BADGE_CATALOG.map((entry) => ({
    entry,
    earned: badges.find((badge) => findCatalogEntry(badge)?.code === entry.code),
  }));
  const extras = badges
    .filter((badge) => !findCatalogEntry(badge))
    .sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime());
  const earnedCount = tiles.filter((tile) => tile.earned).length + extras.length;
  return { tiles, extras, earnedCount, total: tiles.length + extras.length };
};

