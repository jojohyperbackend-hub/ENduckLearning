import type { ComponentType } from "react";
import { Link, useLocation } from "react-router";
import { BookOpen, Bot, CircleUserRound, House } from "lucide-react";
import { motion } from "motion/react";

type NavIcon = ComponentType<{ size?: number; strokeWidth?: number }>;

interface BottomNavItem {
  to: string;
  label: string;
  icon: NavIcon; // ganti sama logo lu sendiri, tinggal samain props-nya
  match: string[]; // prefix path yang bikin item ini aktif
}

const ITEMS: BottomNavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: House, match: ["/dashboard"] },
  { to: "/lessons", label: "Pelajaran", icon: BookOpen, match: ["/lessons"] },
  { to: "/quiz/generate", label: "Quiz AI", icon: Bot, match: ["/quiz"] },
  { to: "/profile", label: "Profil", icon: CircleUserRound, match: ["/profile"] },
];

const BottomNav = () => {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-4 bottom-4 z-50 md:hidden"
    >
      <ul className="grid h-16 grid-cols-4 rounded-2xl bg-[var(--color-bg-card)] shadow-[0_8px_20px_rgba(40,60,99,0.18)]">
        {ITEMS.map(({ to, label, icon: Icon, match }) => {
          const isActive = match.some((m) => pathname.startsWith(m));

          return (
            <li key={to} className="relative">
              {/* Bubble bulat: warnanya sama kayak bar, pindah via layoutId */}
              {isActive && (
                <div className="pointer-events-none absolute inset-x-0 -top-5 flex justify-center">
                  <motion.span
                    layoutId="bottom-nav-bubble"
                    className="h-14 w-14 rounded-full bg-[var(--color-bg-card)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                </div>
              )}

              <Link
                to={to}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className="relative z-10 flex h-full items-center justify-center text-[var(--color-text)]"
              >
                <motion.span
                  className="flex"
                  animate={{ y: isActive ? -22 : 0, scale: isActive ? 1.1 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 26 }}
                >
                  <Icon size={26} strokeWidth={isActive ? 2.2 : 1.8} />
                </motion.span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default BottomNav;