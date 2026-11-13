import type { Progress } from "../types";

// Kabar ke halaman yang lagi kebuka kalau progress (XP, badge) berubah dari luar halaman itu,
// misalnya dari shortcut cheat XP, biar angkanya langsung ke-update tanpa reload.
const PROGRESS_CHANGED = "grammarise:progress-changed";

export const emitProgressChanged = (progress: Progress) => {
  window.dispatchEvent(new CustomEvent<Progress>(PROGRESS_CHANGED, { detail: progress }));
};

export const onProgressChanged = (handler: (progress: Progress) => void) => {
  const listener = (event: Event) => handler((event as CustomEvent<Progress>).detail);
  window.addEventListener(PROGRESS_CHANGED, listener);
  return () => window.removeEventListener(PROGRESS_CHANGED, listener);
};
