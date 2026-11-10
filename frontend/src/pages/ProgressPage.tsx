const ProgressPage = () => {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">Progress</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#283c63]/15 bg-[var(--color-bg-card)] p-5">
          <p className="text-sm uppercase tracking-wide text-[var(--color-text)]/60">
            Total XP
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--color-text)]">
            1,250
          </h2>
        </div>
        <div className="rounded-2xl border border-[#283c63]/15 bg-[var(--color-bg-card)] p-5">
          <p className="text-sm uppercase tracking-wide text-[var(--color-text)]/60">
            Badge
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--color-text)]">
            4
          </h2>
        </div>
      </div>
    </section>
  );
};

export default ProgressPage;
