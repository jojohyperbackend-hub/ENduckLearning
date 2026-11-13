import { useNavigate } from "react-router"; // 1. Tambahkan import ini
import { useAuth } from "../hooks/useAuth";
import { useProgressPage } from "../hooks/useProgressPage";
import { Flame, Zap, Medal, LogOut, ArrowRight } from "lucide-react"; // Tambah ikon ArrowRight opsional untuk tombol

const ProfilePage = () => {
  const navigate = useNavigate(); // 2. Inisialisasi navigate
  const { logout, user } = useAuth();
  const { state } = useProgressPage();

  const isReady = state.status === "ready";
  const progress = isReady ? state.data.progress : null;
  const reviewItems = isReady ? (state.data.reviewItems ?? []) : [];
  const units = isReady ? (state.data.units ?? []) : [];

  const lessonDone = units.reduce(
    (total, unit) =>
      total + unit.lessons.filter((lesson) => lesson.completed).length,
    0,
  );
  const lessonTotal = units.reduce(
    (total, unit) => total + unit.lessons.length,
    0,
  );

  const displayEmail = user?.email ?? "user@example.com";
  const displayName = displayEmail.includes("@")
    ? displayEmail
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "Pengguna";
  const initials = (displayEmail.split("@")[0] || "P")
    .slice(0, 2)
    .toUpperCase();
  const xp = progress?.total_xp ?? 0;
  const streak = progress?.current_streak ?? 0;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
      <div className="mt-2 flex items-center gap-4 rounded-3xl bg-white p-5 shadow-[0_8px_16px_rgba(0,0,0,0.03)]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#283c63] text-2xl font-bold text-white">
          {initials}
        </div>
        <div className="flex flex-col">
          <h1 className="font-heading text-xl font-bold leading-tight text-[#1c2b4a]">
            {displayName}
          </h1>
          <p className="text-sm font-medium text-gray-400">{displayEmail}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-4 text-center shadow-[0_8px_16px_rgba(0,0,0,0.03)]">
          <Flame size={28} className="fill-[#F56A79] text-[#F56A79]" />
          <p className="mt-2 font-heading text-lg font-bold leading-tight text-[#1c2b4a]">
            Hari {streak}
          </p>
          <p className="text-xs font-semibold text-[#1c2b4a]/60">Streak</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-4 text-center shadow-[0_8px_16px_rgba(0,0,0,0.03)]">
          <Zap size={28} className="fill-[#F56A79] text-[#F56A79]" />
          <p className="mt-2 font-heading text-lg font-bold leading-tight text-[#1c2b4a]">
            XP {xp}
          </p>
          <p className="text-xs font-semibold text-[#1c2b4a]/60">Total XP</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-4 text-center shadow-[0_8px_16px_rgba(0,0,0,0.03)]">
          <Medal size={28} className="fill-[#F56A79] text-[#F56A79]" />
          <p className="mt-2 font-heading text-lg font-bold leading-tight text-[#1c2b4a]">
            {lessonDone}/{lessonTotal || 0}
          </p>
          <p className="text-xs font-semibold text-[#1c2b4a]/60">Pelajaran</p>
        </div>
      </div>

      {/* Card Review */}
      <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-[0_8px_16px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-[#1c2b4a]">
            Lihat Kesalahan ({reviewItems.length})
          </h2>
          <span className="inline-flex items-center justify-center rounded-full bg-[#FFD1D6] px-3 py-1 text-center text-xs font-bold text-[#D84556]">
            Perlu diulang
          </span>
        </div>

        {reviewItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-[#F4EFE6] p-4 text-sm text-[#1c2b4a]/70">
            Belum ada review yang perlu diulang.
          </div>
        ) : (
          reviewItems.map((item) => (
            <div
              key={item.review_id}
              className="rounded-2xl border border-gray-300/60 bg-[#F4EFE6] p-4 text-sm text-[#1c2b4a]"
            >
              <p className="font-bold">
                “{item.exercise?.question ?? "Review soal"}”
              </p>
              <p className="mt-1 leading-relaxed">
                <span className="font-bold">Topik:</span>{" "}
                {item.exercise?.topic ?? "Umum"}
              </p>
            </div>
          ))
        )}

        {/* 3. Tambahkan Tombol Navigate di Sini */}
        <button
          type="button"
          onClick={() => navigate("/progress#review")}
          disabled={reviewItems.length === 0}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#283c63] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1c2b4a] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Lihat <ArrowRight size={18} />
        </button>
      </div>

      <div className="mt-12 md:mt-auto">
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#F56A79] py-3.5 text-lg font-bold text-[#1c2b4a] shadow-sm transition active:scale-[0.98]"
        >
          Keluar <LogOut size={22} strokeWidth={2.5} />
        </button>
      </div>
    </section>
  );
};

export default ProfilePage;
