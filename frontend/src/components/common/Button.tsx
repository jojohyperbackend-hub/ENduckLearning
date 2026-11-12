import { type LucideIcon, type LucideProps } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "disabled" | "loading";
  isLoading?: boolean;
  loadingText?: string;
  icon?: LucideIcon;
  iconProps?: LucideProps;
  iconPosition?: "left" | "right";
  size?: "sm" | "md" | "lg";
  fullwidth?: boolean;
}

const variantStyles = {
  default:
    "cursor-pointer border border-[var(--color-text)]/70 bg-[var(--color-cta)] text-[var(--color-text)] shadow-[0_4px_0_rgba(40,60,99,0.8)] hover:border-[var(--color-text)]/60 hover:bg-[var(--color-cta-soft)] hover:text-[var(--color-text)] hover:shadow-[0_8px_24px_rgba(40,60,99,0.16)]",
  disabled:
    "cursor-not-allowed border border-[var(--color-text)]/20 bg-[var(--color-bg-card)] text-[var(--color-text)]/55 opacity-80 shadow-[0_4px_0_rgba(40,60,99,0.08)]",
  loading:
    "cursor-not-allowed border border-[var(--color-cta)] bg-[var(--color-cta)] text-white shadow-[0_4px_0_rgba(40,60,99,0.8)]",
};

const sizeStyles = {
  sm: "min-w-[120px] px-4 py-2 text-sm",
  md: "min-w-[180px] px-6 py-3 text-base",
  lg: "min-w-[220px] px-8 py-4 text-lg",
};

const Button = ({
  variant = "default",
  isLoading = false,
  loadingText = "Memuat...",
  icon,
  iconProps,
  iconPosition = "left",
  type = "button",
  size = "md",
  fullwidth = false,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) => {
  const sizeMap = { sm: 16, md: 20, lg: 24 };
  const iconSize = iconProps?.size ?? sizeMap[size];
  const Icon = icon;

  const renderIcon = () => {
    if (!Icon) return null;
    return <Icon size={iconSize} {...iconProps} />;
  };

  const appliedVariant = isLoading
    ? "loading"
    : disabled
      ? "disabled"
      : variant;

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={[
        "inline-flex w-fit items-center justify-center gap-2 rounded-full font-bold transition-all duration-200",
        "font-body",
        "hover:scale-[1.03] active:scale-[0.98] motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
        sizeStyles[size],
        fullwidth ? "w-full" : "",
        variantStyles[appliedVariant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {isLoading ? (
        <>
          <LoadingSpinner
            size="sm"
            className="border-[var(--color-text)]/20 border-t-white"
          />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {iconPosition === "left" && renderIcon()}
          <span>{children}</span>
          {iconPosition === "right" && renderIcon()}
        </>
      )}
    </button>
  );
};

export default Button;
