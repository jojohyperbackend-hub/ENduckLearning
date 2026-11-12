type CardProps = {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
};

const Card = ({ children, className = "", hoverable = false }: CardProps) => {
  const classes = [
    "rounded-2xl border border-[#283c63]/15 bg-[var(--color-bg-card)] shadow-[0_10px_25px_rgba(40,60,99,0.06)]",
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
