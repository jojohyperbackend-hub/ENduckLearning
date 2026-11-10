type LoadingSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-3",
  lg: "h-12 w-12 border-4",
};

const LoadingSpinner = ({
  size = "md",
  className = "",
}: LoadingSpinnerProps) => {
  return (
    <div
      className={[
        "inline-block animate-spin rounded-full border border-[var(--color-text)]/15 border-t-[var(--color-cta)]",
        sizeMap[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Loading"
    />
  );
};

export default LoadingSpinner;
