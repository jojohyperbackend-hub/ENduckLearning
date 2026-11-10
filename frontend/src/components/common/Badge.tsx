import { type LucideIcon } from "lucide-react";

type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
  icon?: LucideIcon;
  iconPosition?: "left" | "right"
  iconClassName?: string;
};

const variantStyles = {
  default:
    "bg-[var(--color-bg-card)] text-[var(--color-text)] border border-[#283c63]/15",
  success: "bg-[#4c9a6b]/10 text-[#4c9a6b] border border-[#4c9a6b]/20",
  warning: "bg-[#f5c76a]/10 text-[#9a6b00] border border-[#f5c76a]/30",
  danger: "bg-[#d94e3f]/10 text-[#d94e3f] border border-[#d94e3f]/20",
};

const Badge = ({
  children,
  variant = "default",
  className = "",
  icon,
  iconPosition = "left",
  iconClassName = ""
}: BadgeProps) => {
    const Icon = icon

  const classes = [
    "inline-flex w-fit gap-2 items-center rounded-full px-2.5 py-1 text-xs font-medium",
    variantStyles[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

const iconClasses = [iconClassName].filter(Boolean).join(" ");

  return <span className={classes}>
    {Icon && iconPosition === "left" && <Icon size={14} className={iconClasses}/>}
    {children}
    {Icon && iconPosition === "right" && <Icon size={14} className={iconClasses}/>}
    </span>;
};

export default Badge;
