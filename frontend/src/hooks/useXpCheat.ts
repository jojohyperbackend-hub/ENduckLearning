import { useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../api/client";
import { claimCheatXp } from "../api/progressApi";
import { emitProgressChanged } from "../utils/progressEvents";

export const CHEAT_XP_AMOUNT = 290;

export type CheatNotice = { id: number; tone: "success" | "error"; message: string };

// Cheat demo: Ctrl + Alt + X -> +290 XP. Cuma jalan kalau user sudah login.
// Pakai event.code (posisi tombol), jadi tetap jalan di layout keyboard apa pun.
export const useXpCheat = (enabled: boolean) => {
  const [notice, setNotice] = useState<CheatNotice | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleKey = async (event: KeyboardEvent) => {
      if (!(event.ctrlKey && event.altKey && event.code === "KeyX") || event.repeat) return;
      event.preventDefault();
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const progress = await claimCheatXp();
        emitProgressChanged(progress);
        setNotice({
          id: Date.now(),
          tone: "success",
          message: `+${CHEAT_XP_AMOUNT} XP. Total XP kamu sekarang ${progress.total_xp.toLocaleString("id-ID")}.`,
        });
      } catch (error) {
        setNotice({ id: Date.now(), tone: "error", message: getErrorMessage(error) });
      } finally {
        busyRef.current = false;
      }
    };

    const listener = (event: KeyboardEvent) => void handleKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [enabled]);

  // Notifikasi hilang sendiri setelah 3 detik.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return notice;
};
