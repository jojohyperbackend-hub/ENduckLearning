import { BookOpen, ChartColumnBigIcon, Shield, Stars } from "lucide-react";
import Card from "../common/Card";

const BenefitSection = () => {
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h2 className="text-heading font-heading font-bold">
          Kenapa harus coba?
        </h2>
        <p className="text-body">
          Nikmati cara belajar interaktif tanpa hafalan membosankan, rasakan
          progres nyata tiap hari cukup 10 menit dari HP-mu, dan tingkatkan
          skill Bahasa Inggris-mu secara terstruktur 100% gratis tanpa biaya
          tersembunyi.
        </p>
      </section>
      <section className="flex gap-4">
        <Card className="flex flex-col gap-4 p-5">
          <div className="bg-[var(--color-correct)]/10 text-[var(--color-correct)] w-fit p-2 rounded-xl">
            <BookOpen />
          </div>
          <h3 className="font-heading text-card-header font-bold">
            Lesson Seru
          </h3>
          <p className="font-body text-body">
            Latihan singkat, dari pilihan ganda sampai terjemahan. Belajar
            selangkah demi selangkah.
          </p>
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <div className="bg-[var(--color-correct)]/10 text-[var(--color-correct)] w-fit p-2 rounded-xl">
            <BookOpen />
          </div>
          <h3 className="font-heading text-card-header font-bold">
            Lesson Seru
          </h3>
          <p className="font-body text-body">
            Latihan singkat, dari pilihan ganda sampai terjemahan. Belajar
            selangkah demi selangkah.
          </p>
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <div className="bg-[var(--color-correct)]/10 text-[var(--color-correct)] w-fit p-2 rounded-xl">
            <BookOpen />
          </div>
          <h3 className="font-heading text-card-header font-bold">
            Lesson Seru
          </h3>
          <p className="font-body text-body">
            Latihan singkat, dari pilihan ganda sampai terjemahan. Belajar
            selangkah demi selangkah.
          </p>
        </Card>
      </section>
      <section>
        <Card className="p-4 flex justify-between">
          <div className="flex gap-2">
            <Shield size={18} />
            <p className="text-body font-body">Aman & Gratis</p>
          </div>
          <div className="flex gap-2">
            <Stars size={18} />
            <p className="text-body font-body">Latihan interaktif</p>
          </div>
          <div className="flex gap-2">
            <ChartColumnBigIcon size={18} />
            <p className="text-body font-body">Progress terlihat</p>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default BenefitSection;
