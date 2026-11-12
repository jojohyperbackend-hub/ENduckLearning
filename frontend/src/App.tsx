import {
  Navigate,
  Route,
  Routes,
  BrowserRouter,
  useLocation,
} from "react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import Lenis from "lenis";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import LessonPage from "./pages/LessonPage";
import ProgressPage from "./pages/ProgressPage";
import QuizGeneratePage from "./pages/QuizGeneratePage";
import Navbar from "./components/common/Navbar";
import Footer from "./components/landing/Footer";
import { useAuth } from "./hooks/useAuth";

interface GuardProps {
  children: ReactNode;
}

// Tunggu cek sesi (cookie) selesai dulu biar gak sempat ke-redirect salah.
const SessionLoading = () => (
  <p className="py-24 text-center text-body-lg" role="status">
    Memuat...
  </p>
);

const PublicOnlyRoute = ({ children }: GuardProps) => {
  const { status } = useAuth();
  if (status === "loading") return <SessionLoading />;
  return status === "authenticated" ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <>{children}</>
  );
};

const ProtectedRoute = ({ children }: GuardProps) => {
  const { status } = useAuth();
  if (status === "loading") return <SessionLoading />;
  return status === "authenticated" ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace />
  );
};

// Instance Lenis dibagi lewat ref modul biar Navbar bisa minta smooth-scroll
// ke section tertentu tanpa bikin file/context baru.
// eslint-disable-next-line react-refresh/only-export-components -- cuma ngaruh ke kecepatan Fast Refresh saat dev, bukan ke behavior
export const lenisRef: { current: Lenis | null } = { current: null };

// eslint-disable-next-line react-refresh/only-export-components -- lihat alasan di atas
export const scrollToSection = (sectionId: string) => {
  const target = document.getElementById(sectionId);
  if (!target) return;

  if (lenisRef.current) {
    lenisRef.current.scrollTo(target, { duration: 1.2, offset: -24 });
  } else {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

const useSmoothScroll = () => {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const isMobile = window.innerWidth < 768;

    const lenis = new Lenis({
      duration: isMobile ? 0.8 : 1.1,
      smoothWheel: true,
      // native touch scrolling tetap dipakai di HP biar gak berat & gak lag
      syncTouch: false,
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);
};

const AppLayout = () => {
  const location = useLocation();
  const showFooter = location.pathname === "/";

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="sticky top-0 z-50">
        <Navbar />
      </div>

      <main className="mx-auto max-w-7xl px-4">
        <Routes>
          <Route
            path="/"
            element={
              <PublicOnlyRoute>
                <LandingPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lesson/:lessonId"
            element={
              <ProtectedRoute>
                <LessonPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <ProgressPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz/generate"
            element={
              <ProtectedRoute>
                <QuizGeneratePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {showFooter && <Footer />}
    </div>
  );
};

const App = () => {
  useSmoothScroll();

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
};

export default App;
