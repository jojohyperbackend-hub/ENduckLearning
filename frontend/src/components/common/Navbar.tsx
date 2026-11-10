import { Link } from "react-router";

const navLinks = [
  { to: "/", label: "Landing" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/progress", label: "Progress" },
  { to: "/quiz/generate", label: "Quiz AI" },
];

const Navbar = () => {
  return (
    <header>
      <nav className="flex items-center justify-between gap-4 px-4 py-4 text-sm">
        <Link
          to="/"
          className="font-heading text-display font-bold tracking-wide text-[var(--color-text)]"
        >
          Gramarise
        </Link>
        <div className="flex items-center gap-3 rounded-full border border-[#283c63]/15 bg-[var(--color-bg-card)] px-3 py-2 text-[var(--color-text)] shadow-[0_8px_20px_rgba(40,60,99,0.12)]">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-full px-3 py-2 transition hover:text-[var(--color-cta)] hover:bg-[var(--color-cta)]/10"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <Link
          to="/login"
          className="rounded-xl bg-[var(--color-cta)] px-7 py-2 text-body-lg text-[var(--color-text)] transition hover:opacity-90 hover:bg-[var(--color-bg-card)] shadow-[0_4px_0_rgba(40,60,99,0.8)]"
        >
          Login
        </Link>
      </nav>
    </header>
  );
};

export default Navbar;
