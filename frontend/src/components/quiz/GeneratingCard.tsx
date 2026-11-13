import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import Card from "../common/Card";
import { formatCountdown } from "../../hooks/useHeartClock";

interface GeneratingCardProps {
  count: number;
  startedAt: number; // performance.now() saat submit
}

const GeneratingCard = ({ count, startedAt }: GeneratingCardProps) => {
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const elapsed = Math.max(0, (now - startedAt) / 1000);

  return (
    <Card className="border-2 border-[var(--color-text)] p-8 text-center shadow-[8px_8px_0_var(--color-cta)] sm:p-12">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
      <span className="sun-rays-spin grid h-16 w-16 place-items-center rounded-full border-2 border-[var(--color-text)] bg-[var(--color-cta)]">
        <Sparkles size={28} aria-hidden="true" />
      </span>
      <h2 className="font-heading text-[2rem] font-extrabold leading-none">
        AI lagi nyusun {count} soal
      </h2>
      <p className="max-w-[40ch] text-body-lg">
        Tiap soal dicek dulu sebelum dikasih ke kamu. Biasanya kurang dari semenit, jangan tutup
        halaman ini.
      </p>
      <p className="font-heading text-3xl font-extrabold tabular-nums" aria-hidden="true">
        {formatCountdown(elapsed)}
      </p>
      </div>
    </Card>
  );
};

export default GeneratingCard;
