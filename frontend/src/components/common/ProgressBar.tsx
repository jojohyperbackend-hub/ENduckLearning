type ProgressBarProps = {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
};

const ProgressBar = ({
  value,
  max = 100,
  className = "",
  barClassName = "",
}: ProgressBarProps) => {
  const safeValue = Math.min(Math.max(value, 0), max);
  const percent = (safeValue / max) * 100;

  return (
    <div
      className={[
        "h-3 w-full overflow-hidden rounded-full bg-[#283c63]/10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "h-full rounded-full bg-[var(--color-cta)] transition-all duration-300",
          barClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

export default ProgressBar;
