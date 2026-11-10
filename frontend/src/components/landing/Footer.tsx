import Discord from "./../../assets/discord-svgrepo-com.svg?react";
import Instagram from "./../../assets/instagram-logo-facebook-2-svgrepo-com.svg?react";
import Github from "./../../assets/github-svgrepo-com.svg?react";

const Footer = () => {
  const socialLinks = [
    { name: "GitHub", href: "https://github.com", icon: Github },
    { name: "Instagram", href: "https://instagram.com", icon: Instagram },
    { name: "Discord", href: "https://discord.com", icon: Discord },
  ];

  return (
    <footer className="mt-12 w-full overflow-hidden rounded-t-[28px] bg-[#1d355b] text-[#f4efe9] shadow-[0_-8px_25px_rgba(27,39,72,0.12)]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-start justify-between gap-10 border-b border-white/20 pb-8">
          <div className="max-w-md">
            <h3 className="text-4xl font-bold leading-tight text-[#f4efe9]">
              GramaRise
            </h3>

            <p className="mt-4 text-base leading-7 text-white/80">
              Platform Belajar Bahasa Inggris interaktif, seru, dan gratis untuk
              membantu kamu berkembang setiap hari.
            </p>

            <div className="mt-6 flex items-center gap-3">
              {socialLinks.map(({ name, href, icon: Icon }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={name}
                  className="flex items-center justify-center rounded-full text-white/80 transition hover:text-white"
                >
                  <Icon className="h-9 w-9 fill-current" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid flex-1 grid-cols-3 gap-10">
            <div>
              <h4 className="mb-4 text-2xl font-bold text-[#f4efe9]">
                Fitur Utama
              </h4>
              <ul className="space-y-3 text-base text-white/80">
                <li>Lesson seru</li>
                <li>Streak & Badge</li>
                <li>AI Latihan</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-2xl font-bold text-[#f4efe9]">
                Tim Kami
              </h4>
              <ul className="space-y-3 text-base text-white/80">
                <li>Tentang Logicodix</li>
                <li>Kontribusi</li>
                <li>GitHub Repository</li>
                <li>Dokumentasi</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-2xl font-bold text-[#f4efe9]">
                Hubungi Kami
              </h4>
              <p className="text-base leading-7 text-white/80">
                Ada pertanyaan atau kolaborasi?
              </p>
              <a
                href="mailto:gramarise@gmail.com"
                className="mt-3 inline-block text-base font-medium text-[#f4efe9] underline decoration-white/40 underline-offset-4 hover:text-white"
              >
                gramarise@gmail.com
              </a>
            </div>
          </div>
        </div>

        <div className="pt-5 text-center text-sm text-white/70">
          © 2026 Burung Hantu 2.0
        </div>
      </div>
    </footer>
  );
};

export default Footer;
