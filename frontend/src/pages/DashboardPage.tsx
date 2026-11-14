import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "react-router";
// import { AnimatePresence, motion } from "motion/react";
import {
  Award,
  ArrowRight,
  Flame,
  Heart,
  Lock,
  RotateCcw,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import HeartsEmptyModal from "../components/common/HeartsEmptyModal";
// import CollapsedProgressBar from "../components/dashboard/CollapsedProgressBar";
import LessonSegments from "../components/dashboard/LessonSegments";
import SunrisePath from "../components/dashboard/SunrisePath";
import UnitRow from "../components/dashboard/UnitRow";
import {
  useDashboard,
  type DashboardData,
  type PathUnit,
} from "../hooks/useDashboard";
import {
  formatCountdown,
  useHeartClock,
  type HeartClock,
  type HeartSnapshot,
} from "../hooks/useHeartClock";
import { getErrorMessage } from "../api/client";
import { AI_MIN_XP, AI_XP_CORRECT, AI_XP_WRONG, checkAiPracticeAccess } from "../utils/aiPracticeAccess";

const MAX_HEARTS = 5;
const DESKTOP_QUERY = "(min-width: 768px)";

const subscribeToDesktop = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const useIsDesktop = () =>
  useSyncExternalStore(
    subscribeToDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
  );

// Lesson aktif terakhir yang dilihat user, buat tahu kapan ada lesson baru kebuka.
const lastActiveKey = (userId: string) =>
  `grammarise:last-active-lesson:${userId}`;
const readLastActive = (userId: string): string | null => {
  try {
    return window.localStorage.getItem(lastActiveKey(userId));
  } catch {
    return null;
  }
};
const writeLastActive = (userId: string, lessonId: string) => {
  try {
    window.localStorage.setItem(lastActiveKey(userId), lessonId);
  } catch {
    // storage diblokir: konfeti cuma gak muncul, dashboard tetap jalan
  }
};

const StatusStrip = ({
  data,
  clock,
}: {
  data: DashboardData;
  clock: HeartClock;
}) => {
  const { total_xp, current_streak, badges } = data.progress;
  const hearts = Math.min(Math.max(clock.hearts, 0), MAX_HEARTS);
  const chip =
    "flex items-center gap-2 rounded-full border border-[#283c63]/15 bg-[var(--color-bg-card)] px-3.5 py-2 text-body font-semibold";

  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
      <li className={chip}>
        <Flame
          size={18}
          className="text-[var(--color-cta)]"
          aria-hidden="true"
        />
        {current_streak} hari
        <span className="sr-only">streak</span>
      </li>
      <li className={chip}>
        <Star
          size={18}
          className="text-[var(--color-cta)]"
          aria-hidden="true"
        />
        {total_xp.toLocaleString("id-ID")} XP
      </li>
      <li className={chip}>
        <span
          role="img"
          aria-label={`${hearts} dari ${MAX_HEARTS} nyawa tersisa`}
          className="flex items-center gap-0.5"
        >
          {Array.from({ length: MAX_HEARTS }, (_, index) => (
            <Heart
              key={index}
              size={17}
              aria-hidden="true"
              className={`transition-colors duration-300 ${
                index < hearts
                  ? "fill-[var(--color-cta)] text-[var(--color-cta)]"
                  : "text-[var(--color-text)]/25"
              }`}
            />
          ))}
        </span>
        {clock.nextIn !== null && hearts < MAX_HEARTS && (
          <span className="text-body-sm tabular-nums text-[var(--color-text)]/70">
            +1 dalam {formatCountdown(clock.nextIn)}
          </span>
        )}
      </li>
      {badges.length > 0 && (
        <li className={chip}>
          <Award
            size={18}
            className="text-[var(--color-correct)]"
            aria-hidden="true"
          />
          {badges.length} Lencana
        </li>
      )}
    </ul>
  );
};

const ContinueCard = ({
  data,
  onStart,
}: {
  data: DashboardData;
  onStart: () => void;
}) => {
  const { focusUnit, nextLesson } = data;
  if (!focusUnit) return null;

  const total = focusUnit.lessons.length;
  const remaining = total - focusUnit.doneCount;

  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-7">
      <p className="flex items-center gap-2 font-heading text-card-header font-bold">
        <Target
          size={20}
          className="text-[var(--color-correct)]"
          aria-hidden="true"
        />
        {nextLesson ? "Lanjut dari sini" : "Jalurnya sudah habis"}
      </p>

      <p className="font-heading text-3xl font-extrabold leading-none sm:text-4xl">
        {nextLesson
          ? `Unit ${focusUnit.number}, Pelajaran ${nextLesson.number}`
          : "Semua pelajaran selesai"}
      </p>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-body-sm">
          <span>Progres unit ini</span>
          <span className="font-semibold">
            {focusUnit.doneCount} dari {total} pelajaran
          </span>
        </div>
        <LessonSegments lessons={focusUnit.lessons} className="max-w-xl" />
      </div>

      <p className="text-body">
        {nextLesson
          ? remaining === 1
            ? "Satu pelajaran lagi, matahari unit ini terbit."
            : `${remaining} pelajaran lagi sampai matahari unit ini terbit.`
          : "Mau tetap latihan? Minta soal baru di Latihan AI."}
      </p>

      {nextLesson && (
        /* di HP tombolnya pindah ke bar bawah yang nempel */
        <div className="hidden md:block">
          <Button onClick={onStart}>Mulai Pelajaran {nextLesson.number}</Button>
        </div>
      )}
    </Card>
  );
};

type AiLaunchState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "locked"; message: string }
  | { status: "error"; message: string };

const ReviewCard = ({ reviewCount }: { reviewCount: number | null }) => {
  const navigate = useNavigate();
  const [launch, setLaunch] = useState<AiLaunchState>({ status: "idle" });

  // Tombol selalu kelihatan. Yang dicek cuma Gerbang 1; Latihan AI gak pakai heart.
  const openAiPractice = async () => {
    if (launch.status === "checking") return;
    setLaunch({ status: "checking" });
    try {
      const access = await checkAiPracticeAccess();
      if (access.status === "locked") {
        setLaunch({ status: "locked", message: access.message });
      } else {
        navigate("/quiz/generate");
      }
    } catch (error) {
      setLaunch({ status: "error", message: getErrorMessage(error) });
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[var(--color-text)] p-5 text-[var(--color-bg-card)] sm:p-7">
      <p className="flex items-center gap-2 font-heading text-card-header font-bold">
        <RotateCcw size={18} aria-hidden="true" />
        Buat diulang
      </p>

      <p className="font-heading text-3xl font-extrabold leading-none sm:text-4xl">
        {reviewCount === null
          ? "Tinjau"
          : reviewCount === 0
            ? "Tinjauan kosong"
            : `${reviewCount} soal di Tinjau`}
      </p>

      <p className="text-body text-[var(--color-bg-card)]/85">
        {reviewCount === null
          ? "Jumlah soal yang di tinjau belum bisa dimuat. Coba muat ulang halaman ini."
          : reviewCount === 0
            ? "Belum ada jawaban salah yang perlu diulang."
            : "Soal yang pernah salah muncul lagi sampai kamu jawab benar."}
      </p>
      {reviewCount !== null && reviewCount > 0 && (
        <Link
          to="/progress#review"
          className="w-fit text-body font-bold underline decoration-2 underline-offset-4 transition hover:text-[var(--color-cta)]"
        >
          Kerjakan hasil Tinjau
        </Link>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t border-[var(--color-bg-card)]/20 pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-heading text-card-header font-bold">
              Latihan AI
            </p>
            <p className="text-body text-[var(--color-bg-card)]/85">
              Soal baru dari topik yang udah kamu pelajari. Butuh minimal {AI_MIN_XP} XP. Benar
              +{AI_XP_CORRECT} XP, salah &minus;{AI_XP_WRONG} XP.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void openAiPractice()}
            disabled={launch.status === "checking"}
            aria-describedby={
              launch.status === "locked" || launch.status === "error"
                ? "ai-launch-note"
                : undefined
            }
            className="inline-flex w-fit shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[var(--color-bg-card)] px-5 py-2.5 text-body font-bold text-[var(--color-text)] transition hover:bg-[var(--color-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-bg-card)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
          >
            <Sparkles size={16} aria-hidden="true" />
            {launch.status === "checking" ? "Mengecek..." : "Buka Latihan AI"}
          </button>
        </div>
        {(launch.status === "locked" || launch.status === "error") && (
          <p
            id="ai-launch-note"
            role="status"
            className="flex items-start gap-2 rounded-xl bg-[var(--color-bg-card)] px-3.5 py-2.5 text-body font-semibold text-[var(--color-text)]"
          >
            {launch.status === "locked" && (
              <Lock size={16} className="mt-1 shrink-0" aria-hidden="true" />
            )}
            {launch.message}
          </p>
        )}
      </div>
    </div>
  );
};

interface FocusUnitProps {
  unit: PathUnit;
  celebrateLessonId: string | null;
  onOpenLesson: (lessonId: string) => void;
}

// Desktop & tablet: panel langit, jalur naik diagonal ke matahari.
const FocusUnitDesktop = ({
  unit,
  celebrateLessonId,
  onOpenLesson,
}: FocusUnitProps) => {
  return (
    <div className="relative mb-2 mr-2 overflow-hidden rounded-3xl shadow-[8px_8px_0_var(--color-cta)]">
      <SunrisePath
        lessons={unit.lessons}
        isComplete={unit.isComplete}
        orientation="diagonal"
        celebrateLessonId={celebrateLessonId}
        onOpenLesson={onOpenLesson}
      />
      <div className="pointer-events-none absolute left-7 top-6 max-w-[55%] text-[var(--color-bg-card)]">
        <p className="text-body">
          Unit {unit.number}
          <span className="mx-2 opacity-60">/</span>
          {unit.isComplete ? "Selesai" : "Sedang dikerjakan"}
        </p>
        <h3 className="mt-1 font-heading text-3xl font-bold leading-tight">
          {unit.title}
        </h3>
        <p className="mt-1 text-body text-[var(--color-bg-card)]/85">
          {unit.doneCount} dari {unit.lessons.length} pelajaran selesai
        </p>
      </div>
    </div>
  );
};

// HP: diringkas jadi satu bar, diketuk baru jalur vertikalnya kebuka.
// const FocusUnitMobile = ({ unit, celebrateLessonId, onOpenLesson }: FocusUnitProps) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const containerRef = useRef<HTMLDivElement>(null);
//   const panelId = useId();

//   // Ketuk di luar area = nutup lagi
//   useEffect(() => {
//     if (!isOpen) return;
//     const handlePointerDown = (event: PointerEvent) => {
//       if (!containerRef.current?.contains(event.target as Node)) {
//         setIsOpen(false);
//       }
//     };
//     document.addEventListener("pointerdown", handlePointerDown);
//     return () => document.removeEventListener("pointerdown", handlePointerDown);
//   }, [isOpen]);

//   // Jalurnya panjang: begitu kebuka, langsung geser ke lesson yang lagi aktif
//   useEffect(() => {
//     if (!isOpen) return;
//     const timeoutId = window.setTimeout(() => {
//       containerRef.current
//         ?.querySelector("[data-active-node]")
//         ?.scrollIntoView({ behavior: "smooth", block: "center" });
//     }, 340);
//     return () => window.clearTimeout(timeoutId);
//   }, [isOpen]);

//   return (
//     <div ref={containerRef}>
//       <Card className="overflow-hidden">
//         <CollapsedProgressBar
//           unit={unit}
//           isOpen={isOpen}
//           onToggle={() => setIsOpen((open) => !open)}
//           panelId={panelId}
//         />
//         <AnimatePresence initial={false}>
//           {isOpen && (
//             <motion.div
//               id={panelId}
//               initial={{ height: 0 }}
//               animate={{ height: "auto" }}
//               exit={{ height: 0 }}
//               transition={{ duration: 0.3, ease: "easeOut" }}
//               className="overflow-hidden"
//             >
//               <SunrisePath
//                 lessons={unit.lessons}
//                 isComplete={unit.isComplete}
//                 orientation="vertical"
//                 celebrateLessonId={celebrateLessonId}
//                 onOpenLesson={onOpenLesson}
//               />
//             </motion.div>
//           )}
//         </AnimatePresence>
//       </Card>
//     </div>
//   );
// };

const DashboardContent = ({ data }: { data: DashboardData }) => {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { units, focusUnit, nextLesson, progress } = data;
  const nextLessonId = nextLesson?.lesson_id ?? null;

  // Konfeti cuma sekali: pas lesson aktif beda dari kunjungan terakhir.
  const [celebrateLessonId] = useState(() => {
    const previous = readLastActive(progress.user_id);
    return previous && nextLessonId && previous !== nextLessonId
      ? nextLessonId
      : null;
  });
  useEffect(() => {
    if (nextLessonId) writeLastActive(progress.user_id, nextLessonId);
  }, [nextLessonId, progress.user_id]);

  const clock = useHeartClock(data.hearts);
  const [heartsModal, setHeartsModal] = useState<HeartSnapshot | null>(null);
  const closeHeartsModal = useCallback(() => setHeartsModal(null), []);

  // Titik A: heart 0 = gak boleh masuk lesson, popup aja. Tombolnya tetap bisa diklik lagi nanti.
  const openLesson = (lessonId: string) => {
    if (clock.hearts <= 0) {
      setHeartsModal(data.hearts);
      return;
    }
    navigate(`/lesson/${lessonId}`);
  };

  return (
    <section
      className={`flex flex-col gap-8 py-8 sm:py-10 ${nextLesson ? "pb-32 md:pb-10" : ""}`}
    >
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-[2.5rem] font-extrabold leading-none tracking-tight sm:text-5xl">
            Selamat datang
          </h1>
          <p className="mt-3 max-w-[44ch] font-heading text-card-header font-semibold sm:text-2xl">
            Satu pelajaran singkat lagi, satu langkah lebih percaya diri.
          </p>
        </div>
        <StatusStrip data={data} clock={clock} />
      </header>

      <div
        className={`grid gap-4 ${focusUnit ? "lg:grid-cols-[1.4fr_1fr]" : ""}`}
      >
        {focusUnit && (
          <ContinueCard
            data={data}
            onStart={() => nextLesson && openLesson(nextLesson.lesson_id)}
          />
        )}
        <ReviewCard
          reviewCount={data.reviewCount}
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-4xl font-extrabold leading-none">
            Pelajaran
          </h2>
          {data.courseTitle && (
            <p className="text-body-lg">{data.courseTitle}</p>
          )}
        </div>

        {units.length === 0 ? (
          <Card className="p-6 sm:p-8">
            <p className="font-heading text-card-header font-bold">
              Belum ada pelajaran
            </p>
            <p className="mt-1 text-body-lg">
              Materinya lagi disiapin. Cek lagi nanti, atau coba Latihan AI
              dulu.
            </p>
          </Card>
        ) : (
          units.map((unit) => {
            const isFocus = unit.unit_id === focusUnit?.unit_id;
            if (!isFocus || !isDesktop) {
              return (
                <UnitRow
                  key={unit.unit_id}
                  unit={unit}
                  onOpenLesson={openLesson}
                />
              );
            }
            return (
              <FocusUnitDesktop
                key={unit.unit_id}
                unit={unit}
                celebrateLessonId={celebrateLessonId}
                onOpenLesson={openLesson}
              />
            );
          })
        )}
        {units.length > 0 && (
          <Link
            to="/lessons"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-cta)] px-7 py-3 text-body-lg font-semibold text-[var(--color-text)] shadow-[0_4px_0_rgba(40,60,99,0.8)] transition active:translate-y-[2px] active:shadow-[0_2px_0_rgba(40,60,99,0.8)] md:hidden"
          >
            Lihat jalur belajar
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        )}
      </div>

      {/* {nextLesson && focusUnit && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[var(--color-text)] bg-[var(--color-bg-card)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
          <Button fullwidth onClick={() => openLesson(nextLesson.lesson_id)}>
            Mulai Lesson {nextLesson.number}, +{nextLesson.xp_reward_base} XP
          </Button>
        </div>
      )} */}

      {heartsModal && (
        <HeartsEmptyModal snapshot={heartsModal} onConfirm={closeHeartsModal} />
      )}
    </section>
  );
};

const DashboardSkeleton = () => (
  <section
    className="flex flex-col gap-8 py-8 sm:py-10"
    role="status"
    aria-label="Memuat dashboard"
  >
    <div className="skeleton h-12 w-64 rounded-xl bg-[var(--color-text)]/10" />
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="skeleton h-56 rounded-2xl bg-[var(--color-bg-card)]" />
      <div className="skeleton h-56 rounded-2xl bg-[var(--color-text)]/20" />
    </div>
    <div className="skeleton h-80 rounded-3xl bg-[var(--color-text)]/20" />
  </section>
);

const DashboardPage = () => {
  const { state, retry } = useDashboard();

  if (state.status === "loading") return <DashboardSkeleton />;

  if (state.status === "error") {
    return (
      <section className="py-10">
        <Card className="mx-auto flex max-w-xl flex-col items-start gap-4 p-6 sm:p-8">
          <h1 className="font-heading text-heading font-bold">
            Dashboard gagal dimuat
          </h1>
          <p className="text-body-lg">{state.message}</p>
          <Button onClick={retry}>Coba lagi</Button>
        </Card>
      </section>
    );
  }

  return (
    <DashboardContent key={state.data.progress.user_id} data={state.data} />
  );
};

export default DashboardPage;
