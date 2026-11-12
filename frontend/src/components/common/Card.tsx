type CardProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "auth";
  hoverable?: boolean;
};

const variantStyles = {
  default:
    "rounded-2xl border border-[#283c63]/15 bg-[var(--color-bg-card)] shadow-[0_10px_25px_rgba(40,60,99,0.06)]",
  auth: "relative isolate w-full max-w-md overflow-hidden rounded-[28px] border border-[#283c63]/15 bg-[var(--color-bg)] shadow-[0_20px_45px_rgba(40,60,99,0.08)] md:max-w-[1080px] md:grid md:grid-cols-[1.05fr_0.95fr]",
};

const Card = ({
  children,
  className = "",
  variant = "default",
  hoverable = false,
}: CardProps) => {
  const classes = [
    variantStyles[variant],
    hoverable
      ? "transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_16px_rgba(40,60,99,0.12)] motion-reduce:hover:translate-y-0"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
};

export default Card;
