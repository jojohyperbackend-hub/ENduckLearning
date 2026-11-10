type CardProps = {
  children: React.ReactNode;
  className?: string;
};

const Card = ({ children, className = "" }: CardProps) => {
  const classes = [
    "rounded-2xl border border-[#283c63]/15 bg-[var(--color-bg-card)] shadow-[0_10px_25px_rgba(40,60,99,0.06)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
};

export default Card;
