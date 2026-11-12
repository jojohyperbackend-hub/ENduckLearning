import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { Menu, X } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { scrollToSection } from "../../App";

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

const Navbar = () => {
  const { pathname } = useLocation();
  const { scrollY } = useScroll();
  const isLandingPage = pathname === "/";

  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [activeSection, setActiveSection] = useState(LANDING_SECTIONS[0].id);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 768px)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleDesktopChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
      if (event.matches) setIsMobileMenuOpen(false);
    };
    const handleMotionChange = (event: MediaQueryListEvent) =>
      setPrefersReducedMotion(event.matches);

    desktopQuery.addEventListener("change", handleDesktopChange);
    motionQuery.addEventListener("change", handleMotionChange);
    return () => {
      desktopQuery.removeEventListener("change", handleDesktopChange);
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }, []);

  // Tutup menu mobile + kunci scroll body selama menu kebuka
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
  useEffect(() => {
    if (!isLandingPage) return;

    const sectionElements = LANDING_SECTIONS.map((section) =>
      document.getElementById(section.id)
    ).filter((el): el is HTMLElement => el !== null);
    if (sectionElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    sectionElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isLandingPage]);

  // scroll-linked, bukan on/off kasar: transparan di atas, solid + shadow
  // makin kuat makin ke bawah (DESIGN.md 7.1), diinterpolasi halus lewat spring
  const scrollProgress = useTransform(scrollY, [0, 120], [0, 1], {
    clamp: true,
  });
  const smoothProgress = useSpring(scrollProgress, {
    stiffness: 260,
    damping: 32,
  });
  const appliedProgress = prefersReducedMotion ? scrollProgress : smoothProgress;

  const backgroundOpacity = useTransform(appliedProgress, [0, 1], [0, 0.95]);
  const background = useMotionTemplate`rgba(251, 232, 211, ${backgroundOpacity})`;
  const shadowOpacity = useTransform(appliedProgress, [0, 1], [0, 0.12]);
  const boxShadow = useMotionTemplate`0 4px 16px rgba(40, 60, 99, ${shadowOpacity})`;
  // backdrop-blur cukup berat buat GPU HP low-end, jadi cuma dipakai di desktop
  const backdropBlur = useTransform(appliedProgress, (value) =>
    isDesktop && value > 0.05 ? "blur(10px)" : "blur(0px)"
  );

  // Efek scroll atas/bawah manual: navbar nyelip ke atas pas discroll ke
  // bawah (fokus ke konten), muncul lagi pas discroll ke atas — jalan buat
  // scroll manual (wheel/touch) maupun smooth-scroll dari Lenis, karena
  // keduanya sama-sama update posisi scroll window asli.
  useMotionValueEvent(scrollY, "change", (latest) => {
    if (prefersReducedMotion || isMobileMenuOpen) {
      setIsHidden(false);
      return;
    }
    const previous = scrollY.getPrevious() ?? 0;
    const delta = latest - previous;

    if (latest < 100) {
      setIsHidden(false);
      return;
    }
    if (delta > 4) {
      setIsHidden(true);
    } else if (delta < -4) {
      setIsHidden(false);
    }
  });

  const handleSectionClick = (sectionId: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    setActiveSection(sectionId);
    setIsMobileMenuOpen(false);
    scrollToSection(sectionId);
  };

  return (
    <motion.header
      style={{ background, boxShadow, backdropFilter: backdropBlur }}
      animate={{ y: isHidden ? "-100%" : "0%" }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
    >
      <nav className="flex items-center justify-between gap-4 px-4 py-4 text-sm">
        <Link
          to="/"
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
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    {section.label}
                  </a>
                );
              })
            : APP_LINKS.map((link) => {
                const manualActive = link.match ? pathname.startsWith(link.match) : false;

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
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
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

        <Link
          to="/login"
          className="hidden rounded-xl bg-[var(--color-cta)] px-7 py-2 text-body-lg text-[var(--color-text)] transition hover:scale-[1.03] active:scale-[0.98] hover:bg-[var(--color-cta-soft)] shadow-[0_4px_0_rgba(40,60,99,0.8)] motion-reduce:hover:scale-100 md:inline-flex"
        >
          Login
        </Link>

        {/* Hamburger: Mobile Kecil - Tablet (<768px), sesuai DESIGN.md Bagian 9 */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          aria-label={isMobileMenuOpen ? "Tutup menu" : "Buka menu"}
          aria-expanded={isMobileMenuOpen}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#283c63]/15 bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-[0_8px_20px_rgba(40,60,99,0.12)] transition active:scale-[0.95] md:hidden"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
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
                    const manualActive = link.match ? pathname.startsWith(link.match) : false;
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
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="mt-1 rounded-xl bg-[var(--color-cta)] px-4 py-3 text-center text-base font-semibold text-[var(--color-text)] shadow-[0_4px_0_rgba(40,60,99,0.8)] transition active:scale-[0.98]"
              >
                Login
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Navbar;
