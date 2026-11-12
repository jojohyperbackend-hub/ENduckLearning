import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import { getErrorMessage } from "../api/client";
import { useAuth } from "../hooks/useAuth";

type Mode = "login" | "register";

const MIN_PASSWORD_LENGTH = 8;

const LoginPage = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isRegister = mode === "register";

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (isRegister && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { email: email.trim(), password };
      if (isRegister) {
        const outcome = await register(payload);
        if (outcome === "needs_login") {
          setNotice("Akun sudah dibuat. Cek email untuk konfirmasi, lalu login.");
          setMode("login");
          setPassword("");
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
    <section className="flex min-h-[60vh] items-center justify-center py-8">
      <div className="w-full max-w-md rounded-2xl border border-[#283c63]/15 bg-[var(--color-bg-card)] p-6 shadow-xl sm:p-8">
        <h1 className="font-heading text-3xl font-bold text-[var(--color-text)]">
          {isRegister ? "Buat akun" : "Masuk ke Grammarise"}
        </h1>
        <p className="mt-2 text-[var(--color-text)]/75">
          {isRegister
            ? "Daftar pakai email, gratis."
            : "Lanjut belajar dari lesson terakhirmu."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
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

          <p className="min-h-5 text-sm" role="alert" aria-live="polite">
            {error && <span className="text-[var(--color-wrong)]">{error}</span>}
            {notice && <span className="text-[var(--color-correct)]">{notice}</span>}
          </p>

          <Button
            type="submit"
            fullwidth
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {isRegister ? "Daftar" : "Masuk"}
          </Button>
        </form>

        <p className="mt-5 text-sm text-[var(--color-text)]/75">
          {isRegister ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(isRegister ? "login" : "register")}
            className="font-semibold text-[var(--color-text)] underline underline-offset-4"
          >
            {isRegister ? "Masuk" : "Daftar"}
          </button>
        </p>
      </div>
    </section>
  );
};

export default LoginPage;
