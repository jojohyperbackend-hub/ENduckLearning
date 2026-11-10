import { Navigate, Route, Routes, BrowserRouter } from "react-router";
import type { ReactNode } from "react";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import LessonPage from "./pages/LessonPage";
import ProgressPage from "./pages/ProgressPage";
import QuizGeneratePage from "./pages/QuizGeneratePage";
import Navbar from "./components/common/Navbar";
import Footer from "./components/landing/Footer";

const isAuthenticated = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("isLoggedIn") === "true";
};

interface GuardProps {
  children: ReactNode;
}

const PublicOnlyRoute = ({ children }: GuardProps) => {
  return isAuthenticated() ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <>{children}</>
  );
};

const ProtectedRoute = ({ children }: GuardProps) => {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <BrowserRouter>
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

        <Footer />
      </div>
    </BrowserRouter>
  );
};

export default App;
