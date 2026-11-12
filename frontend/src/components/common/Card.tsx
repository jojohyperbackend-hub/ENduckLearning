type CardProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "auth";
};

const variantStyles = {
  default:
    "rounded-2xl border border-[#283c63]/15 bg-[var(--color-bg-card)] shadow-[0_10px_25px_rgba(40,60,99,0.06)]",
  auth: "w-full max-w-[1080px] overflow-hidden rounded-[28px] border border-[#283c63]/15 bg-white shadow-[0_20px_45px_rgba(40,60,99,0.08)] md:grid md:grid-cols-[1.05fr_0.95fr]",
};

const Card = ({ children, className = "", variant = "default" }: CardProps) => {
  const classes = [variantStyles[variant], className].filter(Boolean).join(" ");

  return <div className={classes}>{children}</div>;
};

export default Card;
