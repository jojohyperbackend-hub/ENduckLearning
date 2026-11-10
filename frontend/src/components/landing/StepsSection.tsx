import Button from "../common/Button";
import Card from "../common/Card";

const StepsSection = () => {
  return (
    <div className="flex flex-col justify-between gap-3">
      <section className="flex flex-col gap-5">
        <p className="text-body font-body">BELAJAR DENGAN RITMEMU</p>
        <h2 className="font-heading text-heading font-bold">
          Mulai kecil. Lanjut tiap hari.
        </h2>
      </section>
      <section className="flex gap-3">
        <Card className="p-7 flex flex-1 flex-col gap-4">
          <p className="text-body font-body font-semibold">
            LANGKAH KECIL, JADI KEBIASAAN
          </p>
          <h2 className="font-heading text-heading font-bold">
            Mulai dari satu <br></br> latihan sederhana
          </h2>
          <p className="text-body font-body font-semibold">
            Tidak harus langsung jago. Kenali materinya, coba jawab, lalu
            lanjutkan sedikit demi sedikit.
          </p>
        </Card>
        <Card className="p-7 flex flex-col gap-5">
          <div>
            <h2 className="text-heading font-heading font-bold">
              Ritme belajar, tanpa ribet
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl w-fit h-fit bg-[var(--color-bg)] font-body text-body font-semibold">
              01
            </div>
            <div>
              <p className="text-card-header font-heading font-semibold">
                Pelajari Materi
              </p>
              <p className="text-body font-body">Mulai dari lesson singkat.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl w-fit h-fit bg-[var(--color-bg)] font-body text-body font-semibold">
              02
            </div>
            <div>
              <p className="text-card-header font-heading font-semibold">
                Coba Latihan
              </p>
              <p className="text-body font-body">Asah pemahaman lewat soal.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl w-fit h-fit bg-[var(--color-bg)] font-body text-body font-semibold">
              03
            </div>
            <div>
              <p className="text-card-header font-heading font-semibold">
                Jaga Kebiasaan
              </p>
              <p className="text-body font-body">
                Lanjutkan belajar esok hari.
              </p>
            </div>
          </div>
        </Card>
      </section>
      <section>
        <Card className="p-7 flex gap-5 justify-between">
          <div>
            <h2 className="text-card-header font-heading font-bold">
              Satu langkah lagi buat mulai.
            </h2>
            <p className="font-body text-body">
              Belajar step by step, gratis. Mulai dari latihan pertamamu
            </p>
          </div>
          <div>
            <Button>Mulai belajar gratis</Button>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default StepsSection;
