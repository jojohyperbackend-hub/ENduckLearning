import { useEffect, useState } from "react";
import { getMyProgress } from "../api/progressApi";
import type { HeartState } from "../types";

export interface HeartSnapshot {
  hearts: number;
  max: number;
  // detik sampai tiap heart balik, dihitung server saat respon dikirim
  regen: number[];
  // performance.now() saat respon diterima: jam monotonik, gak kepengaruh jam device diubah
  receivedAt: number;
  // jam dinding saat respon diterima, cuma buat nampilin "penuh pukul berapa"
  receivedWall: number;
}

export const toHeartSnapshot = (state: HeartState): HeartSnapshot => ({
  hearts: state.hearts_remaining,
  max: state.heart_max || 5,
  regen: [...(state.heart_regen_in_seconds ?? [])].sort((a, b) => a - b),
  receivedAt: performance.now(),
  receivedWall: Date.now(),
});

// Dipakai saat API nolak dengan HEARTS_EMPTY: ambil jadwal heart terbaru dari server.
export const loadHeartSnapshot = async (): Promise<HeartSnapshot> => {
  try {
    return toHeartSnapshot(await getMyProgress());
  } catch {
    return {
      hearts: 0,
      max: 5,
      regen: [],
      receivedAt: performance.now(),
      receivedWall: Date.now(),
    };
  }
};

export interface HeartClock {
  hearts: number;
  max: number;
  // detik sampai heart berikutnya balik, null kalau gak ada yang lagi dihitung
  nextIn: number | null;
  // detik sampai heart penuh lagi
  fullIn: number | null;
  // epoch ms (jam dunia nyata) saat heart penuh lagi
  fullAt: number | null;
}

// Hitung mundur lokal tiap detik dari angka server, tanpa nanya ulang ke API.
export const useHeartClock = (snapshot: HeartSnapshot): HeartClock => {
  const [tick, setTick] = useState(() => ({
    perf: snapshot.receivedAt,
    wall: snapshot.receivedWall,
  }));
  const hasPending = snapshot.regen.length > 0;

  useEffect(() => {
    if (!hasPending) return;
    const update = () => setTick({ perf: performance.now(), wall: Date.now() });
    const first = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [snapshot, hasPending]);

  const elapsed = Math.max(0, (tick.perf - snapshot.receivedAt) / 1000);
  const remaining = snapshot.regen.map((seconds) => seconds - elapsed);
  const returned = remaining.filter((seconds) => seconds <= 0).length;
  const pending = remaining.filter((seconds) => seconds > 0);
  const hearts = Math.min(snapshot.max, Math.max(0, snapshot.hearts + returned));
  const nextIn = pending.length > 0 ? Math.ceil(pending[0]) : null;
  const fullIn = pending.length > 0 ? Math.ceil(pending[pending.length - 1]) : null;
  const wallNow = Math.max(tick.wall, snapshot.receivedWall);

  return {
    hearts,
    max: snapshot.max,
    nextIn,
    fullIn,
    fullAt: fullIn !== null ? wallNow + fullIn * 1000 : null,
  };
};

export const formatCountdown = (seconds: number): string => {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
};

export const formatClockTime = (epochMs: number): string =>
  new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(epochMs),
  );
