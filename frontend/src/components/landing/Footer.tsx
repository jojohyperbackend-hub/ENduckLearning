import Discord from "./../../assets/discord-svgrepo-com.svg?react";
import Github from "./../../assets/github-svgrepo-com.svg?react";

const socialLinks = [
  {
    name: "GitHub",
    href: "https://github.com",
    icon: Github,
    iconClass: "[&_path]:stroke-current [&_path]:fill-none",
  },
  {
    name: "Discord",
    href: "https://discord.com",
    icon: Discord,
    iconClass: "[&_path]:fill-current",
  },
];

const Footer = () => {
  return (
    <footer className="mt-16 w-full rounded-t-3xl bg-[var(--color-text)] text-[var(--color-bg-card)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-sm flex-col gap-2">
          <p className="font-heading text-3xl font-bold leading-none">
            Grammarise
          </p>
          <p className="text-body-lg text-[var(--color-bg-card)]/75">
            Learn English, Grow. Belajar Bahasa Inggris pelan-pelan, gratis.
          </p>
          <a
            href="mailto:gramarise@gmail.com"
            className="mt-2 w-fit break-all text-body-lg underline decoration-[var(--color-bg-card)]/40 underline-offset-4 hover:decoration-[var(--color-bg-card)]"
          >
            gramarise@gmail.com
          </a>
        </div>

        <div className="flex flex-col gap-4 md:items-end">
          <div className="flex items-center gap-4">
            {socialLinks.map(({ name, href, icon: Icon, iconClass }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={name}
                className="text-[var(--color-bg-card)]/80 transition hover:text-[var(--color-bg-card)]"
              >
                <Icon className={`h-8 w-8 ${iconClass}`} />
              </a>
            ))}
          </div>
          <p className="text-body text-[var(--color-bg-card)]/65">
            © 2026 LOGICODIX 2026
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
