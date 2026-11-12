type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  variant?: "default" | "login"
};

const variantStyles = {
    default: "w-full rounded-xl border border-[#283c63]/15 bg-white px-3 py-2.5 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text)]/45 focus:border-[var(--color-cta)] focus:ring-2 focus:ring-[var(--color-cta)]/15",
    login: "w-full border-b border-[var(--color-text)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text)]/45"
  }

const Input = ({ label, variant = "default", className = "", ...props }: InputProps) => {
  const classes = [variantStyles[variant], className].filter(Boolean).join(" ");

  return (
    <label className="block space-y-2 text-sm text-[var(--color-text)]/80">
      {label ? <span>{label}</span> : null}
      <input className={classes} {...props} />
    </label>
  );
};

export default Input;
