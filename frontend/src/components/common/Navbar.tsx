import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { scrollToSection } from "../../App";
import { useAuth } from "../../hooks/useAuth";
import { Heart, Menu, Star, X } from "lucide-react";
import { useHeartClock } from "../../hooks/useHeartClock";
import { useDashboard, type DashboardData } from "../../hooks/useDashboard";

// Nav khusus landing page: scrollspy ke section, sesuai DESIGN.md
// wireframe desktop ("Beranda Fitur Cara Kerja Tim")
const LANDING_SECTIONS = [
  { id: "beranda", label: "Beranda" },
  { id: "fitur", label: "Fitur" },
  { id: "cara-kerja", label: "Cara Kerja" },
  { id: "tim", label: "Tim" },
];

// Nav buat halaman aplikasi (setelah login)
const APP_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/progress", label: "Progress" },
  { to: "/quiz/generate", label: "Quiz AI", match: "/quiz" },
];

const HeaderStatsReady = ({ data }: { data: DashboardData }) => {
  const clock = useHeartClock(data.hearts);

  const chip =
    "flex items-center gap-1.5 rounded-full bg-[var(--color-bg-card)] px-3 py-1.5 text-body-sm font-semibold";

  return (
    <div className="flex items-center gap-2">
      <span className={chip}>
        <Heart
          size={15}
          className="fill-[var(--color-cta)] text-[var(--color-cta)]"
          aria-hidden="true"
        />
        {Math.min(Math.max(clock.hearts, 0), 5)}
      </span>
      <span className={chip}>
        <Star size={15} className="text-[var(--color-cta)]" aria-hidden="true" />
        {data.progress.total_xp.toLocaleString("id-ID")} XP
      </span>
    </div>
  );
};

const HeaderStats = () => {
  const { state } = useDashboard();
  if (state.status !== "ready") return null;
  return <HeaderStatsReady data={state.data} />;
};

const Navbar = () => {
  const { pathname } = useLocation();
  const isLandingPage = pathname === "/";
  const { isAuthenticated, logout } = useAuth();

  const [activeSection, setActiveSection] = useState(LANDING_SECTIONS[0].id);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Pas layar melebar ke desktop, menu mobile otomatis ketutup
  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 768px)");

    const handleDesktopChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsMobileMenuOpen(false);
    };

    desktopQuery.addEventListener("change", handleDesktopChange);
    return () => {
      desktopQuery.removeEventListener("change", handleDesktopChange);
    };
  }, []);

  // Kunci scroll body selama menu mobile kebuka
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  // Scrollspy: deteksi section mana yang lagi di tengah layar, biar
  // nav "ngikutin" konten pas discroll dari atas ke bawah (ataupun sebaliknya)
  // Dihitung dari posisi scroll (bukan IntersectionObserver) dan section
  // di-query ulang tiap update, jadi tetep jalan walau section baru muncul
  // di DOM setelah Navbar mount (lazy load, Suspense, dll).
  useEffect(() => {
    if (!isLandingPage) return;

    let frame = 0;

    const updateActiveSection = () => {
      frame = 0;
      const middle = window.innerHeight / 2;

      for (const section of LANDING_SECTIONS) {
        const el = document.getElementById(section.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= middle && rect.bottom > middle) {
          setActiveSection(section.id);
          break;
        }
      }
    };

    const handleScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isLandingPage]);

  const handleSectionClick =
    (sectionId: string) => (event: React.MouseEvent) => {
      event.preventDefault();
      setActiveSection(sectionId);
      setIsMobileMenuOpen(false);
      scrollToSection(sectionId);
    };

  const showStats = isAuthenticated && !isLandingPage && pathname !== "/login";

  return (
    <header className="bg-[var(--color-bg-card)]">
      <nav className="flex items-center justify-between gap-4 px-4 py-4 text-sm">
        <Link
          to={isAuthenticated ? "/dashboard" : "/"}
          className="font-heading text-2xl font-bold tracking-wide text-[var(--color-text)] md:text-display"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Grammarise
        </Link>

        {/* Nav penuh: Laptop Kecil (≥768px) ke atas, sesuai DESIGN.md Bagian 9 */}
        <div className="relative hidden items-center gap-1 rounded-full border border-[#283c63]/15 bg-[var(--color-bg-card)] px-3 py-2 text-[var(--color-text)] shadow-[0_8px_20px_rgba(40,60,99,0.12)] md:flex">
          {isLandingPage
            ? LANDING_SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    onClick={handleSectionClick(section.id)}
                    className={`relative z-10 whitespace-nowrap rounded-full px-3 py-2 transition ${
                      isActive
                        ? "font-semibold text-cta"
                        : "hover:text-cta hover:bg-cta/10"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-pill"
                        className="absolute inset-0 -z-10 rounded-full bg-cta/20"
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 30,
                        }}
                      />
                    )}
                    {section.label}
                  </a>
                );
              })
            : APP_LINKS.map((link) => {
                const manualActive = link.match
                  ? pathname.startsWith(link.match)
                  : false;

                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end
                    className={({ isActive }) =>
                      `relative z-10 whitespace-nowrap rounded-full px-3 py-2 transition ${
                        isActive || manualActive
                          ? "font-semibold text-cta"
                          : "hover:text-cta hover:bg-cta/10"
                      }`
                    }
                  >
                    {({ isActive }) =>
                      isActive || manualActive ? (
                        <>
                          <motion.span
                            layoutId="nav-active-pill"
                            className="absolute inset-0 -z-10 rounded-full bg-cta/20"
                            transition={{
                              type: "spring",
                              stiffness: 350,
                              damping: 30,
                            }}
                          />
                          {link.label}
                        </>
                      ) : (
                        link.label
                      )
                    }
                  </NavLink>
                );
              })}
        </div>

        {showStats && (
          <div className="md:hidden">
            <HeaderStats />
          </div>
        )}

        {isAuthenticated ? (
          <button
            type="button"
            onClick={() => void logout()}
            className="hidden rounded-xl bg-[var(--color-cta)] px-7 py-2 text-body-lg text-[var(--color-text)] transition hover:scale-[1.03] active:scale-[0.98] hover:bg-[var(--color-cta-soft)] shadow-[0_4px_0_rgba(40,60,99,0.8)] motion-reduce:hover:scale-100 md:inline-flex cursor-pointer"
          >
            Keluar
          </button>
        ) : (
          <Link
            to="/login"
            className="hidden rounded-xl bg-[var(--color-cta)] px-7 py-2 text-body-lg text-[var(--color-text)] transition hover:scale-[1.03] active:scale-[0.98] hover:bg-[var(--color-cta-soft)] shadow-[0_4px_0_rgba(40,60,99,0.8)] motion-reduce:hover:scale-100 md:inline-flex"
          >
            Login
          </Link>
        )}

        {/* Hamburger: Mobile Kecil - Tablet (<768px), sesuai DESIGN.md Bagian 9 */}
        {!isAuthenticated && (
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            aria-label={isMobileMenuOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={isMobileMenuOpen}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#283c63]/15 bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-[0_8px_20px_rgba(40,60,99,0.12)] transition active:scale-[0.95] md:hidden"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        )}
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden px-4 md:hidden"
          >
            <div className="flex flex-col gap-1 rounded-2xl border border-[#283c63]/15 bg-[var(--color-bg-card)] p-3 shadow-[0_8px_20px_rgba(40,60,99,0.12)]">
              {isLandingPage
                ? LANDING_SECTIONS.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      onClick={handleSectionClick(section.id)}
                      className={`rounded-xl px-4 py-3 text-base transition ${
                        activeSection === section.id
                          ? "bg-cta/15 font-semibold text-cta"
                          : "hover:bg-cta/10"
                      }`}
                    >
                      {section.label}
                    </a>
                  ))
                : APP_LINKS.map((link) => {
                    const manualActive = link.match
                      ? pathname.startsWith(link.match)
                      : false;
                    return (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        end
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `rounded-xl px-4 py-3 text-base transition ${
                            isActive || manualActive
                              ? "bg-cta/15 font-semibold text-cta"
                              : "hover:bg-cta/10"
                          }`
                        }
                      >
                        {link.label}
                      </NavLink>
                    );
                  })}
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    void logout();
                  }}
                  className="mt-1 rounded-xl bg-[var(--color-cta)] px-4 py-3 text-center text-base font-semibold text-[var(--color-text)] shadow-[0_4px_0_rgba(40,60,99,0.8)] transition active:scale-[0.98] cursor-pointer"
                >
                  Keluar
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mt-1 rounded-xl bg-[var(--color-cta)] px-4 py-3 text-center text-base font-semibold text-[var(--color-text)] shadow-[0_4px_0_rgba(40,60,99,0.8)] transition active:scale-[0.98]"
                >
                  Login
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
