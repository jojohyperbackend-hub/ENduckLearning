const LoginPage = () => {
  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-[#283c63]/15 bg-[var(--color-bg-card)] p-8 shadow-xl">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-cta)]">
          Masuk
        </p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">
          Login ke ENduckLearning
        </h1>
        <p className="mt-3 text-[var(--color-text)]/75">
          Masuk dengan akun Google untuk melanjutkan belajar.
        </p>

        <button
          type="button"
          className="mt-6 w-full rounded-xl bg-[var(--color-cta)] px-4 py-3 font-semibold text-white transition hover:opacity-90"
          onClick={() => {
            window.localStorage.setItem("isLoggedIn", "true");
            window.location.href = "/dashboard";
          }}
        >
          Login dengan Google
        </button>
      </div>
    </section>
  );
};

export default LoginPage;
