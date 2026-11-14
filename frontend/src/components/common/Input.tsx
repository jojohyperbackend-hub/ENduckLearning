import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  variant?: "default" | "login" | "email";
};

const variantStyles = {
  default:
    "w-full rounded-xl border border-[#283c63]/15 bg-white px-3 py-2.5 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text)]/45 focus:border-[var(--color-cta)] focus:ring-2 focus:ring-[var(--color-cta)]/15",
  login:
    "w-full border-b border-[var(--color-text)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text)]/45 focus:outline-none focus:ring-0",
  email:
    "w-full border-b border-[var(--color-text)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text)]/45 focus:outline-none focus:ring-0",
};

const Input = ({
  label,
  variant = "default",
  className = "",
  type,
  ...props
}: InputProps) => {
  const [showPassword, setShowPassword] = useState(false);

  const classes = [variantStyles[variant], className].filter(Boolean).join(" ");

  // Toggle mata hanya muncul untuk field password
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <label className="block space-y-2 text-sm text-[var(--color-text)]/80">
      {label ? <span>{label}</span> : null}
      <div className="flex items-center">
        <input className={classes} type={inputType} {...props} />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            aria-pressed={showPassword}
            className="ml-2 p-1 text-[var(--color-text)]/70 transition hover:text-[var(--color-text)]"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
    </label>
  );
};

export default Input;