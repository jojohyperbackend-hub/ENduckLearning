import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import Card from "../components/common/Card";
import { getErrorMessage } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { ArrowLeft } from "lucide-react";
import googleIcon from "../assets/google.png";
import { hasOAuthCallback } from "../lib/supabase";

type Mode = "login" | "register";

const MIN_PASSWORD_LENGTH = 8;

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Bentuk bg cream (area form) yang melebar ke hero.
 * - idle     : posisi awal, tepinya lurus pas di batas form (belum masuk hero)
 * - login    : melebar ke hero dengan kemiringan landai
 * - register : melebar lebih jauh dengan kemiringan lebih tajam
 *
 * Aturan biar bisa di-interpolate halus: urutan & unit tiap titik harus sama
 * di semua state (x pakai %, y pakai px di mobile; x pakai px, y pakai % di desktop).
 *
 * Mobile  : layer nongol 80px (-top-20) ke atas masuk hero.
 * Desktop : layer nongol 128px (-left-32) ke kiri masuk hero.
 */
const mobileClip: Variants = {
  idle: { clipPath: "polygon(0% 80px, 100% 80px, 100% 100%, 0% 100%)" },
  login: { clipPath: "polygon(0% 56px, 100% 28px, 100% 100%, 0% 100%)" },
  register: { clipPath: "polygon(0% 68px, 100% 0px, 100% 100%, 0% 100%)" },
};

const desktopClip: Variants = {
  idle: { clipPath: "polygon(128px 0%, 100% 0%, 100% 100%, 128px 100%)" },
  login: { clipPath: "polygon(84px 0%, 100% 0%, 100% 100%, 20px 100%)" },
  register: { clipPath: "polygon(112px 0%, 100% 0%, 100% 100%, 0px 100%)" },
};

// stagger masuk buat isi form (cuma jalan sekali pas halaman kebuka)
const formVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.4 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
};

const LoginPage = () => {
  const { login, register, startGoogleLogin, completeGoogleLogin } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // true dari awal kalau halaman ini kebuka dari redirect Google (lagi nuker token)
  const [isGoogleLoading, setIsGoogleLoading] = useState(hasOAuthCallback);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isRegister = mode === "register";

  const clipTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 1.1, ease };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setConfirmPassword("");
  };

  // Balik dari Google: tukar token Supabase jadi sesi cookie backend.
  // Kalau sukses, route guard otomatis pindah ke /dashboard.
  useEffect(() => {
    if (!hasOAuthCallback()) return;
    completeGoogleLogin()
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setIsGoogleLoading(false));
  }, [completeGoogleLogin]);

  const handleGoogle = async () => {
    setError(null);
    setNotice(null);
    setIsGoogleLoading(true);
    try {
      await startGoogleLogin(); // browser pindah ke Google
    } catch (err) {
      setError(getErrorMessage(err));
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (isRegister) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = { email: email.trim(), password };
      if (isRegister) {
        const outcome = await register(payload);
        if (outcome === "needs_login") {
          setNotice(
            "Account created. Check your email to confirm it, then log in.",
          );
          setMode("login");
          setPassword("");
          setConfirmPassword("");
          return;
        }
      } else {
        await login(payload);
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <motion.div
        className="flex w-full justify-center"
        initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease }}
      >
        <Card variant="auth">
          {/* ================= HERO (mobile: atas, desktop: kiri) ================= */}
          <div className="relative px-6 pb-24 pt-6 md:flex md:min-h-[600px] md:flex-col md:px-12 md:py-10 md:pr-36">
            {/* Ornamen. Ganti sama logo/ilustrasi Grammarise kalau udah ada, mis.
                <img src={logo} alt="" className="absolute -right-10 top-6 w-64 opacity-20" /> */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 top-4 size-56 rounded-full bg-[var(--color-cta)]/20 blur-2xl md:-right-10 md:top-10 md:size-80"
              animate={
                reduceMotion ? undefined : { y: [0, -14, 0], scale: [1, 1.06, 1] }
              }
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute -left-12 bottom-10 size-40 rounded-full bg-[var(--color-text)]/10 blur-2xl md:size-64"
              animate={
                reduceMotion ? undefined : { y: [0, 12, 0], scale: [1, 1.08, 1] }
              }
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative z-10 flex flex-1 flex-col">
              <button
                type="button"
                onClick={() => navigate("/")}
                aria-label="Back"
                className="-ml-1 w-fit rounded-full p-1 text-[var(--color-text)] transition-transform duration-200 hover:-translate-x-0.5"
              >
                <ArrowLeft />
              </button>

              <div className="mt-8 md:my-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.28, ease }}
                  >
                    <h1 className="font-heading text-4xl font-extrabold leading-[1.05] text-[var(--color-text)] md:text-5xl">
                      {isRegister
                        ? "Buat akun anda"
                        : "Masuk akun anda"}
                    </h1>
                    <p className="mt-4 max-w-sm font-heading text-base font-semibold leading-snug text-[var(--color-text)]">
                      {isRegister
                        ? "Yuk, gabung gratis dan tingkatkan kemampuan bahasa Inggrismu!"
                        : "Selamat datang kembali di Grammarise! Kelihatannya ada yang lagi semangat belajar bahasa Inggris, nih!"}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ================= FORM (mobile: bawah, desktop: kanan) ================= */}
          <div className="relative px-6 pb-8 pt-2 md:flex md:flex-col md:justify-center md:px-12 md:py-12">
            {/* bg cream versi mobile: melebar ke ATAS masuk hero */}
            <motion.div
              aria-hidden="true"
              className="absolute inset-x-0 -top-20 bottom-0 bg-[var(--color-bg-card)] md:hidden"
              variants={mobileClip}
              initial="idle"
              animate={mode}
              transition={clipTransition}
            />
            {/* bg cream versi desktop: melebar ke KIRI masuk hero */}
            <motion.div
              aria-hidden="true"
              className="absolute inset-y-0 -left-32 right-0 hidden bg-[var(--color-bg-card)] md:block"
              variants={desktopClip}
              initial="idle"
              animate={mode}
              transition={clipTransition}
            />

            <motion.form
              onSubmit={handleSubmit}
              className="relative z-10 space-y-4"
              variants={formVariants}
              initial={reduceMotion ? "show" : "hidden"}
              animate="show"
            >
              <motion.div variants={fadeUp}>
                <Input
                  variant="login"
                  label="Email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </motion.div>

              <motion.div variants={fadeUp}>
                <Input
                  variant="login"
                  label="Password"
                  type="password"
                  name="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  required
                  minLength={isRegister ? MIN_PASSWORD_LENGTH : undefined}
                  maxLength={72}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </motion.div>

              <AnimatePresence initial={false}>
                {isRegister && (
                  <motion.div
                    key="confirm-password"
                    className="overflow-hidden"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease }}
                  >
                    <Input
                      variant="login"
                      label="Repeat Password"
                      type="password"
                      name="confirmPassword"
                      autoComplete="new-password"
                      required
                      maxLength={72}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="min-h-5 text-sm" role="alert" aria-live="polite">
                {error && (
                  <span className="text-[var(--color-wrong)]">{error}</span>
                )}
                {notice && (
                  <span className="text-[var(--color-correct)]">{notice}</span>
                )}
              </p>

              <motion.div variants={fadeUp} className="space-y-3">
                <Button
                  type="submit"
                  fullwidth
                  isLoading={isSubmitting}
                  loadingText="Mohon tunggu..."
                  disabled={isSubmitting || isGoogleLoading}
                >
                  {isRegister ? "Daftar" : "Masuk"}
                </Button>

                <p className="text-center text-caption text-[var(--color-text)]/70">
                  Atau masuk dengan
                </p>

                <Button
                  type="button"
                  fullwidth
                  isLoading={isGoogleLoading}
                  loadingText="Mohon tunggu..."
                  disabled={isSubmitting || isGoogleLoading}
                  onClick={handleGoogle}
                >
                  <span className="flex items-center justify-center gap-2">
                    <img src={googleIcon} alt="" className="size-5" />
                    Google
                  </span>
                </Button>
              </motion.div>

              <motion.p
                variants={fadeUp}
                className="text-center text-body-sm text-[var(--color-text)]/75"
              >
                {isRegister ? "Sudah memiliki akun?" : "Belum memiliki akun?"}{" "}
                <button
                  type="button"
                  onClick={() => switchMode(isRegister ? "login" : "register")}
                  disabled={isSubmitting || isGoogleLoading}
                  className="font-semibold text-[var(--color-text)] underline underline-offset-4"
                >
                  {isRegister ? "Masuk" : "Daftar"}
                </button>
              </motion.p>
            </motion.form>
          </div>
        </Card>
      </motion.div>
    </section>
  );
};

export default LoginPage;