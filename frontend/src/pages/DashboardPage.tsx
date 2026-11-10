const DashboardPage = () => {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">
          Dashboard
        </h1>
        <span className="rounded-full bg-[var(--color-cta)]/15 px-3 py-1 text-sm font-medium text-[var(--color-cta)]">
          Progress aktif
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#283c63]/15 bg-[var(--color-bg-card)] p-5">
          <p className="text-sm uppercase tracking-wide text-[var(--color-text)]/60">
            Course
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            Basic English
          </h2>
        </div>
        <div className="rounded-2xl border border-[#283c63]/15 bg-[var(--color-bg-card)] p-5">
          <p className="text-sm uppercase tracking-wide text-[var(--color-text)]/60">
            XP
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            1,250
          </h2>
        </div>
        <div className="rounded-2xl border border-[#283c63]/15 bg-[var(--color-bg-card)] p-5">
          <p className="text-sm uppercase tracking-wide text-[var(--color-text)]/60">
            Streak
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            7 hari
          </h2>
        </div>
      </div>
    </section>
  );
};

export default DashboardPage;
