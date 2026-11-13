import { createPortal } from "react-dom";
import { Star, TriangleAlert } from "lucide-react";
import type { CheatNotice } from "../../hooks/useXpCheat";

// Notifikasi kecil di bawah layar setelah shortcut cheat XP ditekan.
const CheatToast = ({ notice }: { notice: CheatNotice | null }) => {
  if (!notice) return null;
  const isError = notice.tone === "error";
  const Icon = isError ? TriangleAlert : Star;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[110] flex justify-center px-4">
      <p
        key={notice.id}
        role={isError ? "alert" : "status"}
        className="modal-pop flex max-w-md items-center gap-3 rounded-2xl border-2 border-[var(--color-text)] bg-[var(--color-bg-card)] px-4 py-3 text-body font-semibold text-[var(--color-text)] shadow-[6px_6px_0_var(--color-cta)]"
      >
        <Icon
          size={22}
          aria-hidden="true"
          className={
            isError
              ? "shrink-0 text-[var(--color-wrong)]"
              : "shrink-0 fill-[var(--color-cta)] text-[var(--color-cta)]"
          }
        />
        {notice.message}
      </p>
    </div>,
    document.body,
  );
};

export default CheatToast;
