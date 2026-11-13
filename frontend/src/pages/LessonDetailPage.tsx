import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import {
  AnimatePresence,
  motion,
  useInView,
  useScroll,
  useTransform,
} from "motion/react";
import { ArrowUp, Check, Lock, Play, SunIcon } from "lucide-react";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import HeartsEmptyModal from "../components/common/HeartsEmptyModal";
import SunMarker from "../components/dashboard/SunMarker";
import {
  useDashboard,
  type DashboardData,
  type PathUnit,
} from "../hooks/useDashboard";
import { useHeartClock, type HeartSnapshot } from "../hooks/useHeartClock";
import { setCloudSegments, clearCloudSegments } from "../states/cloudLayer";
import { lenisRef } from "../App";

type LessonItem = PathUnit["lessons"][number];
type NodeStatus = "done" | "active" | "locked";

const ROW_H = 104; // tinggi tiap baris lesson
const SUN_H = 150; // area matahari di puncak unit
const TITLE_H = 84; // area judul unit di dasar unit
const OFFSETS = [26, 50, 74, 50]; // posisi x (%) zigzag, diulang per lesson

const lastUnitKey = (userId: string) => `grammarise:last-opened-unit:${userId}`;
const readLastUnit = (userId: string): string | null => {
  try {
    return window.localStorage.getItem(lastUnitKey(userId));
  } catch {
    return null;
  }
};
const writeLastUnit = (userId: string, unitId: string) => {
  try {
    window.localStorage.setItem(lastUnitKey(userId), unitId);
  } catch {
    // storage diblokir: animasi awan cuma gak muncul
  }
};

const scrollToY = (y: number, duration = 1.2) => {
  if (lenisRef.current) lenisRef.current.scrollTo(y, { duration });
  else window.scrollTo({ top: y, behavior: "smooth" });
};

// Jarak elemen dari atas DOKUMEN (bukan viewport) — dipakai buat ngasih tau
// CloudLayer di App.tsx posisi tiap unit, biar awannya nempel pas pas scroll.
const useDocTop = (ref: { current: HTMLElement | null }) => {
  const [docTop, setDocTop] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      setDocTop(el.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    window.addEventListener("resize", measure);
    const retry = window.setTimeout(measure, 300); // jaga-jaga font/gambar baru kelar nge-load
    return () => {
      window.removeEventListener("resize", measure);
      window.clearTimeout(retry);
    };
  }, [ref]);
  return docTop;
};

/* ───────────── Jalur putus-putus + node lesson ───────────── */

const TrailPath = ({ count }: { count: number }) => {
  const height = count * ROW_H;
  const pts = Array.from({ length: count }, (_, k) => ({
    x: OFFSETS[(count - 1 - k) % OFFSETS.length],
    y: k * ROW_H + ROW_H / 2,
  }));
  const d = pts
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = pts[i - 1];
      const mid = (prev.y + p.y) / 2;
      return `C ${prev.x} ${mid}, ${p.x} ${mid}, ${p.x} ${p.y}`;
    })
    .join(" ");

  return (
    <svg
      className="pointer-events-none absolute inset-x-0 top-0 w-full"
      style={{ height }}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--color-bg-card)"
        strokeOpacity={0.7}
        strokeWidth={2.5}
        strokeDasharray="2 7"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

const NODE_STYLE: Record<NodeStatus, string> = {
  done: "bg-[var(--color-correct)] text-white",
  active: "bg-[var(--color-cta)] text-[var(--color-text)]",
  locked: "bg-[var(--color-bg-card)] text-[var(--color-text)]/50",
};

interface LessonNodeProps {
  lesson: LessonItem;
  status: NodeStatus;
  x: number;
  top: number;
  selected: boolean;
  onSelect: () => void;
  onClose: () => void;
  onStart: () => void;
}

const LessonNode = ({
  lesson,
  status,
  x,
  top,
  selected,
  onSelect,
  onClose,
  onStart,
}: LessonNodeProps) => (
  <div
    className="absolute -translate-x-1/2 -translate-y-1/2"
    style={{ left: `${x}%`, top, zIndex: selected ? 30 : 10 }}
  >
    <AnimatePresence>
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.9 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full left-1/2 mb-3 w-40 -translate-x-1/2 rounded-2xl bg-[var(--color-bg-card)] p-3 text-center text-[var(--color-text)] shadow-[0_8px_20px_rgba(40,60,99,0.25)]"
        >
          <p className="font-heading text-lg font-bold leading-tight">
            Pelajaran {lesson.number}
          </p>
          <p className="text-body-sm opacity-70">+{lesson.xp_reward_base} XP</p>
          <button
            type="button"
            onClick={onStart}
            className="mt-2 w-full cursor-pointer rounded-full bg-[var(--color-cta)] py-1.5 text-body-sm font-bold transition active:scale-[0.97]"
          >
            {status === "done" ? "Ulangi" : "Mulai"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 cursor-pointer text-body-sm opacity-60"
          >
            Batal
          </button>
          <span className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1.5 rotate-45 bg-[var(--color-bg-card)]" />
        </motion.div>
      )}
    </AnimatePresence>

    <motion.button
      type="button"
      data-active-node={status === "active" ? "" : undefined}
      aria-label={`Lesson ${lesson.number}, ${
        status === "done"
          ? "selesai"
          : status === "active"
            ? "lagi dikerjakan"
            : "terkunci"
      }`}
      aria-disabled={status === "locked"}
      onClick={(e) => {
        e.stopPropagation();
        if (status !== "locked") onSelect();
      }}
      whileTap={status === "locked" ? { x: [0, -4, 4, -4, 0] } : { y: 3 }}
      className={`relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl shadow-[0_5px_0_rgba(40,60,99,0.8)] ${NODE_STYLE[status]}`}
    >
      {status === "active" && (
        <motion.span
          className="absolute inset-0 rounded-2xl border-4 border-[var(--color-cta)]"
          animate={{ scale: [1, 1.4], opacity: [0.7, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          aria-hidden="true"
        />
      )}
      {status === "done" && (
        <Check size={28} strokeWidth={3} aria-hidden="true" />
      )}
      {status === "active" && (
        <Play size={26} fill="currentColor" aria-hidden="true" />
      )}
      {status === "locked" && <Lock size={24} aria-hidden="true" />}
    </motion.button>
  </div>
);

/* ───────────── Satu unit ───────────── */

interface UnitSectionProps {
  unit: PathUnit;
  unitIndex: number;
  focusIndex: number;
  reveal: boolean;
  selectedId: string | null;
  onSelect: (lessonId: string | null) => void;
  onStart: (lessonId: string) => void;
  onCoveredChange: (unitId: string, covered: boolean) => void;
  prevUnitNumber?: number; // Tambahkan prop ini
}

const UnitSection = ({
  unit,
  unitIndex,
  focusIndex,
  reveal,
  selectedId,
  onSelect,
  onStart,
  onCoveredChange,
  prevUnitNumber,
}: UnitSectionProps) => {
  const isLocked = unitIndex > focusIndex;
  const isCurrent = unitIndex === focusIndex;
  const total = unit.lessons.length;
  const doneCount =
    unitIndex < focusIndex ? total : isCurrent ? unit.doneCount : 0;
  const complete = total > 0 && doneCount >= total;
  const height = SUN_H + total * ROW_H + TITLE_H;

  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [dispersed, setDispersed] = useState(false);

  useEffect(() => {
    if (!reveal || !inView) return;
    const id = window.setTimeout(() => setDispersed(true), 800);
    return () => window.clearTimeout(id);
  }, [reveal, inView]);

  const covered = isLocked || (reveal && !dispersed);

  useEffect(() => {
    onCoveredChange(unit.unit_id, covered);
  }, [unit.unit_id, covered, onCoveredChange]);

  const statusOf = (i: number): NodeStatus => {
    if (isLocked) return "locked";
    if (!isCurrent) return "done";
    if (i < unit.doneCount) return "done";
    return i === unit.doneCount ? "active" : "locked";
  };

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {/* Teks Overlay saat Tertutup Awan (muncul di atas segalanya) */}
      {covered && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-6 text-center pointer-events-none text-[var(--color-text)]">
          <div className="flex items-center gap-2 rounded-full bg-[var(--color-text)]/5 px-4 py-1.5 text-body-sm font-semibold backdrop-blur-md">
            <Lock size={16} className="text-[#F5A623]" />
            <span>Tertutup Awan Penuh</span>
          </div>
          <h2 className="mt-4 text-center font-heading text-2xl font-bold leading-tight drop-shadow-sm">
            Unit {unit.number} — {unit.title}
          </h2>
          <div className="mt-5 flex items-center gap-2 rounded-full border border-[var(--color-text)]/10 bg-white px-5 py-2.5 text-body-sm font-medium shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
            <span className="text-lg leading-none"><SunIcon/></span>
            <span>
              Selesaikan Matahari Unit {prevUnitNumber ?? 1} untuk membuka
            </span>
          </div>
        </div>
      )}

      <div
        className="relative flex flex-col items-center justify-center gap-2"
        style={{ height: SUN_H }}
      >
        <SunMarker size={92} fill={total ? doneCount / total : 0} tone="sky" />
        <span className="whitespace-nowrap text-body-sm font-semibold text-[var(--color-bg-card)]">
          {complete ? "Unit selesai" : "Akhir unit"}
        </span>
      </div>

      <div className="relative" style={{ height: total * ROW_H }}>
        <TrailPath count={total} />
        {unit.lessons.map((lesson, i) => (
          <LessonNode
            key={lesson.lesson_id}
            lesson={lesson}
            status={statusOf(i)}
            x={OFFSETS[i % OFFSETS.length]}
            top={(total - 1 - i) * ROW_H + ROW_H / 2}
            selected={selectedId === lesson.lesson_id}
            onSelect={() => onSelect(lesson.lesson_id)}
            onClose={() => onSelect(null)}
            onStart={() => onStart(lesson.lesson_id)}
          />
        ))}
      </div>

      {/* Label Unit Bawah: Sembunyikan opacity-nya saat awan menutupi */}
      <div
        className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center transition-opacity duration-700"
        style={{ height: TITLE_H, opacity: covered ? 0 : 1 }}
      >
        <div className="rounded-2xl bg-[var(--color-bg-card)] px-5 py-2 text-center text-[var(--color-text)] shadow-[0_4px_12px_rgba(40,60,99,0.2)]">
          <p className="text-body-sm opacity-70">Unit {unit.number}</p>
          <h2 className="font-heading text-xl font-bold leading-tight">
            {unit.title}
          </h2>
        </div>
      </div>
    </div>
  );
};

/* ───────────── Halaman ───────────── */

const LessonRoadmap = ({ data }: { data: DashboardData }) => {
  const navigate = useNavigate();
  const { units, focusUnit, progress } = data;
  const focusIndex = focusUnit
    ? Math.max(
        units.findIndex((u) => u.unit_id === focusUnit.unit_id),
        0,
      )
    : units.length;

  const clock = useHeartClock(data.hearts);
  const [heartsModal, setHeartsModal] = useState<HeartSnapshot | null>(null);
  const closeHeartsModal = useCallback(() => setHeartsModal(null), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openLesson = (lessonId: string) => {
    if (clock.hearts <= 0) {
      setSelectedId(null);
      setHeartsModal(data.hearts);
      return;
    }
    navigate(`/lesson/${lessonId}`);
  };

  const [revealUnitId] = useState(() => {
    if (!focusUnit) return null;
    const previous = readLastUnit(progress.user_id);
    return previous && previous !== focusUnit.unit_id
      ? focusUnit.unit_id
      : null;
  });
  useEffect(() => {
    if (focusUnit) writeLastUnit(progress.user_id, focusUnit.unit_id);
  }, [focusUnit, progress.user_id]);

  useLayoutEffect(() => {
    const bottom = document.documentElement.scrollHeight;
    if (lenisRef.current)
      lenisRef.current.scrollTo(bottom, { immediate: true });
    else window.scrollTo(0, bottom);
  }, []);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const el = document.querySelector("[data-active-node]");
      if (!el) return;
      scrollToY(
        el.getBoundingClientRect().top +
          window.scrollY -
          window.innerHeight / 2,
        1.4,
      );
    }, 600);
    return () => window.clearTimeout(id);
  }, []);

  const { scrollYProgress } = useScroll();
  const backgroundColor = useTransform(
    scrollYProgress,
    [0, 0.45, 1],
    ["#1b2745", "#7a819c", "#fdebd0"],
  );
  const backgroundGrid = "grid-bg";

  // ── Awan: dihitung di sini, digambar di CloudLayer (App.tsx) ──
  const containerRef = useRef<HTMLDivElement>(null);
  const containerTop = useDocTop(containerRef);
  const [coveredMap, setCoveredMap] = useState<Record<string, boolean>>({});
  const handleCoveredChange = useCallback((id: string, covered: boolean) => {
    setCoveredMap((prev) =>
      prev[id] === covered ? prev : { ...prev, [id]: covered },
    );
  }, []);

  const heights = units.map(
    (unit) => SUN_H + unit.lessons.length * ROW_H + TITLE_H,
  );
  const cumulativeTop = (index: number) =>
    heights.slice(index + 1).reduce((sum, h) => sum + h, 0);

  // Bersihin cuma pas halaman ini beneran ditinggalin (unmount)
  useEffect(() => clearCloudSegments, []);

  useEffect(() => {
    setCloudSegments(
      units.map((unit, index) => ({
        id: unit.unit_id,
        top: containerTop + cumulativeTop(index),
        height: heights[index],
        covered: coveredMap[unit.unit_id] ?? index > focusIndex,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, containerTop, coveredMap, focusIndex]);

  return (
    <section>
      <motion.div
        aria-hidden="true"
        className={`fixed inset-0 -z-10 ${backgroundGrid}`}
        style={{ backgroundColor }}
      />

      <header className="sticky top-0 z-99 -mx-4 rounded-b-3xl bg-[var(--color-bg-card)] shadow-[0_6px_16px_rgba(40,60,99,0.15)] md:hidden">
        <button
          type="button"
          onClick={() => scrollToY(0, 1.6)}
          className="flex w-full cursor-pointer flex-col items-center gap-1 px-4 pb-2 pt-3 text-body-sm font-semibold"
        >
          <ArrowUp size={16} aria-hidden="true" />
          Ke atas
        </button>
      </header>

      {units.length === 0 ? (
        <Card className="mx-auto mt-8 max-w-sm p-6">
          <p className="font-heading text-card-header font-bold">
            Belum ada pelajaran
          </p>
          <p className="mt-1 text-body-lg">
            Materinya lagi disiapin. Cek lagi nanti ya.
          </p>
        </Card>
      ) : (
        <div
          ref={containerRef}
          className="mx-auto flex w-full max-w-sm flex-col-reverse pb-6"
          onClick={() => setSelectedId(null)}
        >
          {units.map((unit, index) => (
            <UnitSection
              key={unit.unit_id}
              unit={unit}
              unitIndex={index}
              focusIndex={focusIndex}
              reveal={unit.unit_id === revealUnitId}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onStart={openLesson}
              onCoveredChange={handleCoveredChange}
              prevUnitNumber={index > 0 ? units[index - 1].number : 1}
            />
          ))}
        </div>
      )}

      {heartsModal && (
        <HeartsEmptyModal snapshot={heartsModal} onConfirm={closeHeartsModal} />
      )}
    </section>
  );
};

const LessonDetailPage = () => {
  const { state, retry } = useDashboard();

  if (state.status === "loading") {
    return (
      <section
        className="flex flex-col gap-6 py-10"
        role="status"
        aria-label="Memuat lesson"
      >
        <div className="skeleton mx-auto h-40 w-full max-w-sm rounded-3xl bg-[var(--color-text)]/20" />
        <div className="skeleton mx-auto h-72 w-full max-w-sm rounded-3xl bg-[var(--color-text)]/20" />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="py-10">
        <Card className="mx-auto flex max-w-xl flex-col items-start gap-4 p-6 sm:p-8">
          <h1 className="font-heading text-heading font-bold">
            Pelajaran gagal dimuat
          </h1>
          <p className="text-body-lg">{state.message}</p>
          <Button onClick={retry}>Coba lagi</Button>
        </Card>
      </section>
    );
  }

  return <LessonRoadmap key={state.data.progress.user_id} data={state.data} />;
};

export default LessonDetailPage;
