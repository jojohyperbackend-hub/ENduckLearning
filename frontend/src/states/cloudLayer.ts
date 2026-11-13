import { useSyncExternalStore } from "react";

export interface CloudSegment {
  id: string;
  // posisi & tinggi dalam px, diukur dari atas DOKUMEN (bukan viewport)
  top: number;
  height: number;
  covered: boolean;
}

let segments: CloudSegment[] = [];
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

export const setCloudSegments = (next: CloudSegment[]) => {
  segments = next;
  notify();
};

export const clearCloudSegments = () => {
  if (segments.length === 0) return;
  segments = [];
  notify();
};

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

const getSnapshot = () => segments;

// Dibaca CloudLayer (dirender di App.tsx, di luar padding <main>) buat tau
// unit mana yang masih harus ketutup awan, posisinya di mana, setinggi apa.
export const useCloudSegments = () => useSyncExternalStore(subscribe, getSnapshot);