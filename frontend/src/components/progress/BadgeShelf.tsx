import { Lock } from "lucide-react";
import type { Badge } from "../../types";
import {
  badgeCollection,
  badgeDescription,
  badgeIconKey,
  badgeTitle,
  type BadgeCatalogEntry,
  type CatalogTile,
  type BadgeTone,
} from "../../utils/badgeCatalog";
import { formatDate } from "../../utils/formatters";
import BadgeSeal from "./BadgeSeal";

const numberFormat = new Intl.NumberFormat("id-ID");

// Warna per badge kalau udah kebuka. Semua flat: border tebal + bayangan geser tanpa blur.
const TONES: Record<
  BadgeTone,
  { tile: string; sealFill: string; sealInk: string; muted: string }
> = {
  ink: {
    tile: "bg-[var(--color-text)] text-[var(--color-bg-card)] shadow-[6px_6px_0_var(--color-cta)]",
    sealFill: "var(--color-cta)",
    sealInk: "var(--color-text)",
    muted: "text-[var(--color-bg-card)]/80",
  },
  pink: {
    tile: "bg-[var(--color-bg-card)] shadow-[6px_6px_0_var(--color-cta)]",
    sealFill: "var(--color-cta)",
    sealInk: "var(--color-text)",
    muted: "text-[var(--color-text)]/75",
  },
  green: {
    tile: "bg-[var(--color-bg-card)] shadow-[6px_6px_0_var(--color-text)]",
    sealFill: "var(--color-correct)",
    sealInk: "var(--color-bg-card)",
    muted: "text-[var(--color-text)]/75",
  },
  cream: {
    tile: "bg-[var(--color-bg-card)] shadow-[6px_6px_0_var(--color-text)]",
    sealFill: "var(--color-wrong)",
    sealInk: "var(--color-bg-card)",
    muted: "text-[var(--color-text)]/75",
  },
};

const LOCKED_TILE =
  "border-dashed border-[var(--color-text)]/35 bg-[var(--color-bg-card)]/55 text-[var(--color-text)]";

const LockedChip = ({ label = "Terkunci" }: { label?: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--color-text)]/25 px-2 py-0.5 text-body-sm font-semibold text-[var(--color-text)]/70">
    <Lock size={12} aria-hidden="true" />
    {label}
  </span>
);

const XpProgress = ({ current, target }: { current: number; target: number }) => {
  const clamped = Math.min(Math.max(current, 0), target);
  const percent = Math.round((clamped / target) * 100);
  return (
    <div className="w-full">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={clamped}
        aria-label={`${numberFormat.format(clamped)} dari ${numberFormat.format(target)} XP`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-text)]/10"
      >
        <div
          className="h-full rounded-full bg-[var(--color-text)]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1.5 text-body-sm font-semibold tabular-nums text-[var(--color-text)]/75">
        {numberFormat.format(clamped)} / {numberFormat.format(target)} XP
      </p>
    </div>
  );
};

const tileBase =
  "group relative flex min-w-0 rounded-3xl border-2 transition-transform duration-200 motion-reduce:transition-none";
const earnedHover = "border-[var(--color-text)] hover:-translate-x-0.5 hover:-translate-y-0.5";
const sealSpin =
  "transition-transform duration-300 group-hover:rotate-[14deg] motion-reduce:transition-none motion-reduce:group-hover:rotate-0";

type TileProps = { tile: CatalogTile; totalXp: number; prerequisiteMet: boolean };

const LockedBody = ({ entry, totalXp, prerequisiteMet }: {
  entry: BadgeCatalogEntry;
  totalXp: number;
  prerequisiteMet: boolean;
}) => (
  <div className="flex w-full flex-col gap-2.5">
    <p className="text-body text-[var(--color-text)]/80">{entry.howTo}</p>
    {entry.criteriaType === "total_xp" && (
      <XpProgress current={totalXp} target={entry.criteriaValue} />
    )}
    {!prerequisiteMet && (
      <p className="text-body-sm font-semibold text-[var(--color-cta)]">Buka Calon Juara dulu.</p>
    )}
  </div>
);

// Tile besar: badge tertinggi. Di HP stempelnya nongol miring dari pojok kanan bawah.
const HeroTile = ({ tile, totalXp, prerequisiteMet }: TileProps) => {
  const { entry, earned } = tile;
  const tone = TONES[entry.tone];
  return (
    <li
      className={`${tileBase} col-span-2 overflow-hidden md:row-span-2 ${
        earned ? `${tone.tile} ${earnedHover}` : LOCKED_TILE
      }`}
    >
      <div className="relative z-10 flex w-full flex-col gap-4 p-5 pr-28 sm:p-6 sm:pr-44 md:justify-between md:p-8 md:pr-8">
        <div className="flex flex-col items-start gap-2">
          {earned ? (
            <span className="rounded-full bg-[var(--color-cta)] px-2.5 py-0.5 text-body-sm font-bold text-[var(--color-text)]">
              Badge tertinggi
            </span>
          ) : (
            <LockedChip />
          )}
          <h3 className="font-heading text-[2.25rem] font-extrabold leading-[0.95] tracking-tight sm:text-5xl md:text-[3.5rem]">
            {earned ? badgeTitle(earned) : entry.name}
          </h3>
        </div>
        {earned ? (
          <div className="flex flex-col gap-1">
            <p className={`max-w-[30ch] text-body-lg md:max-w-[62%] ${tone.muted}`}>{entry.earnedLine}</p>
            <p className={`text-body-sm ${tone.muted}`}>Didapat {formatDate(earned.earned_at)}</p>
          </div>
        ) : (
          <div className="max-w-[34ch] md:max-w-[62%]">
            <LockedBody entry={entry} totalXp={totalXp} prerequisiteMet={prerequisiteMet} />
          </div>
        )}
      </div>
      <BadgeSeal
        icon={entry.icon}
        locked={!earned}
        fill={tone.sealFill}
        ink={tone.sealInk}
        iconSize={54}
        className={`pointer-events-none absolute -bottom-6 -right-8 h-36 w-36 rotate-[-12deg] sm:h-48 sm:w-48 md:-bottom-8 md:-right-8 md:h-44 md:w-44 lg:-bottom-10 lg:-right-10 lg:h-72 lg:w-72 ${
          earned ? sealSpin : ""
        }`}
      />
    </li>
  );
};

const WideTile = ({ tile, totalXp, prerequisiteMet }: TileProps) => {
  const { entry, earned } = tile;
  const tone = TONES[entry.tone];
  return (
    <li
      className={`${tileBase} col-span-2 items-center gap-4 p-5 sm:gap-5 sm:p-6 ${
        earned ? `${tone.tile} ${earnedHover}` : LOCKED_TILE
      }`}
    >
      <BadgeSeal
        icon={entry.icon}
        locked={!earned}
        fill={tone.sealFill}
        ink={tone.sealInk}
        iconSize={34}
        className={`relative h-20 w-20 sm:h-24 sm:w-24 ${earned ? sealSpin : ""}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-2xl font-extrabold leading-none sm:text-3xl">
            {earned ? badgeTitle(earned) : entry.name}
          </h3>
          {!earned && <LockedChip />}
        </div>
        {earned ? (
          <>
            <p className={`text-body ${tone.muted}`}>{entry.earnedLine}</p>
            <p className={`text-body-sm ${tone.muted}`}>Didapat {formatDate(earned.earned_at)}</p>
          </>
        ) : (
          <LockedBody entry={entry} totalXp={totalXp} prerequisiteMet={prerequisiteMet} />
        )}
      </div>
    </li>
  );
};

const SmallTile = ({ tile, totalXp, prerequisiteMet }: TileProps) => {
  const { entry, earned } = tile;
  const tone = TONES[entry.tone];
  return (
    <li
      className={`${tileBase} col-span-1 flex-col gap-3 p-4 sm:p-5 ${
        earned ? `${tone.tile} ${earnedHover}` : LOCKED_TILE
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <BadgeSeal
          icon={entry.icon}
          locked={!earned}
          fill={tone.sealFill}
          ink={tone.sealInk}
          iconSize={26}
          className={`relative h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] ${earned ? sealSpin : ""}`}
        />
        {!earned && (
          <span className="mt-1" aria-hidden="true">
            <Lock size={16} className="text-[var(--color-text)]/45" />
          </span>
        )}
      </div>
      <div className="mt-auto flex flex-col gap-1">
        <h3 className="font-heading text-card-header font-extrabold leading-tight sm:text-xl">
          {earned ? badgeTitle(earned) : entry.name}
          {!earned && <span className="sr-only"> (terkunci)</span>}
        </h3>
        {earned ? (
          <>
            <p className={`text-body-sm sm:text-body ${tone.muted}`}>{entry.earnedLine}</p>
            <p className={`text-body-sm ${tone.muted}`}>{formatDate(earned.earned_at)}</p>
          </>
        ) : (
          <LockedBody entry={entry} totalXp={totalXp} prerequisiteMet={prerequisiteMet} />
        )}
      </div>
    </li>
  );
};

// Badge lama dari database yang gak ada di katalog tetap ditampilkan.
const ExtraTile = ({ badge }: { badge: Badge }) => {
  const tone = TONES.cream;
  return (
    <li className={`${tileBase} col-span-1 flex-col gap-3 p-4 sm:p-5 ${tone.tile} ${earnedHover}`}>
      <BadgeSeal
        icon={badgeIconKey(badge)}
        fill="var(--color-text)"
        ink="var(--color-bg-card)"
        iconSize={26}
        className={`relative h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] ${sealSpin}`}
      />
      <div className="mt-auto flex flex-col gap-1">
        <h3 className="font-heading text-card-header font-extrabold leading-tight sm:text-xl">
          {badgeTitle(badge)}
        </h3>
        <p className={`text-body-sm sm:text-body ${tone.muted}`}>{badgeDescription(badge)}</p>
        <p className={`text-body-sm ${tone.muted}`}>{formatDate(badge.earned_at)}</p>
      </div>
    </li>
  );
};

const TILE_BY_SIZE = { hero: HeroTile, wide: WideTile, small: SmallTile } as const;

const BadgeShelf = ({ badges, totalXp }: { badges: Badge[]; totalXp: number }) => {
  const { tiles, extras } = badgeCollection(badges);
  const earnedCodes = new Set(tiles.filter((tile) => tile.earned).map((tile) => tile.entry.code));

  return (
    // pr/pb ngasih ruang buat bayangan geser biar gak kepotong.
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 pb-1.5 pr-1.5 sm:gap-4 md:grid-cols-4 md:auto-rows-[minmax(11rem,auto)] md:gap-5">
      {tiles.map((tile) => {
        const Tile = TILE_BY_SIZE[tile.entry.size];
        const prerequisiteMet = !tile.entry.requires || earnedCodes.has(tile.entry.requires);
        return (
          <Tile
            key={tile.entry.code}
            tile={tile}
            totalXp={totalXp}
            prerequisiteMet={prerequisiteMet}
          />
        );
      })}
      {extras.map((badge) => (
        <ExtraTile key={badge.badge_id} badge={badge} />
      ))}
    </ul>
  );
};

export default BadgeShelf;
