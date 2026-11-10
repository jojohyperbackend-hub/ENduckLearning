const LessonPage = () => {
  return (
    <section className="rounded-2xl border border-[#283c63]/15 bg-[var(--color-bg-card)] p-8">
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-cta)]">
        Lesson
      </p>
      <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">
        Lesson 1: Greetings
      </h1>
      <p className="mt-3 max-w-2xl text-[var(--color-text)]/75">
        Ini placeholder halaman lesson. Nanti bisa diisi soal, heart indicator,
        dan progress bar sesuai PRD.
      </p>
    </section>
  );
};

export default LessonPage;
