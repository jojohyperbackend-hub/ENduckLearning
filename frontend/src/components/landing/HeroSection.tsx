import Badge from "../common/Badge";
import Button from "../common/Button";
import illustration from "../../assets/landing.png";
import { Check, Clock, Smartphone } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="flex">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-5">
          <Badge variant="danger">Bahasa Inggris, satu langkah lagi</Badge>
          <h1 className="text-5xl font-heading font-extrabold">
            Belajar Bahasa Inggris Jadi Seru dan Gampang
          </h1>
          <p>
            Kayak main game, tapi otakmu makin jago Bahasa Inggris. Belajar step
            by step, gratis!
          </p>
        </section>
        <section className="flex flex-col gap-4">
          <Button size="sm">Mulai belajar gratis</Button>
          <div>
            <Badge icon={Check} iconClassName="text-[var(--color-correct)]">100% Gratis</Badge>
            <Badge icon={Clock} iconClassName="text-[var(--color-correct)]">10 menit/hari</Badge>
            <Badge icon={Smartphone} iconClassName="text-[var(--color-correct)]">Bisa dari HP</Badge>
          </div>
        </section>
      </div>
      <div className="w-full max-w-[400px]">
        <img src={illustration} alt="illustration" className="w-full h-auto" />
      </div>
    </section>
  );
};

export default HeroSection;
