interface ProgressSegmentsProps {
  done: number;
  total: number;
  className?: string;
  label: string;
}

// Satu ruas per lesson, hijau kalau sudah selesai. Datar, tanpa gradasi.
const ProgressSegments = ({ done, total, className = "", label }: ProgressSegmentsProps) => (
  <div role="img" aria-label={label} className={`flex gap-1.5 ${className}`}>
    {Array.from({ length: total }, (_, index) => (
      <span
        key={index}
        className={`h-3 flex-1 rounded-full transition-colors duration-500 ${
          index < done ? "bg-[var(--color-correct)]" : "bg-[var(--color-text)]/12"
        }`}
      />
    ))}
  </div>
);

export default ProgressSegments;
