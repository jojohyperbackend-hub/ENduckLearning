import { ArrowLeft } from "lucide-react";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import Input from "../components/common/Input";
import GoogleIcon from "./../assets/google.png";

const LoginPage = () => {
  return (
    <section className="flex min-h-[80vh] items-center justify-center px-4 py-8">
      <Card variant="auth" className="w-full max-w-[980px]">
        <section className="relative overflow-hidden bg-[var(--color-bg-card)] px-5 pb-8 pt-5 md:px-8 md:pb-10 md:pt-7">
          <button
            type="button"
            aria-label="Back"
            className="mb-8 flex h-11 w-11 items-center justify-center rounded-full border border-[#283c63]/15 bg-white/35 text-2xl text-[var(--color-text)] shadow-sm transition hover:bg-white/60"
          >
            <ArrowLeft />
          </button>

          <div className="relative z-10">
            <h2 className="max-w-[320px] font-heading text-[clamp(2.4rem,5vw,4.1rem)] leading-[0.9] font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
              Login to your
              <br />
              account
            </h2>

            <p className="mt-6 max-w-[340px] text-base font-medium leading-relaxed text-[var(--color-text)]/80 md:text-lg">
              Welcome back To Grammarise! looks like someone decide to be better
              at english, huh?
            </p>
          </div>

          <div className="pointer-events-none absolute -bottom-12 left-0 right-0 z-0 h-40 opacity-80">
            {/* logo taro sini */}
          </div>
        </section>

        <section className="bg-white px-5 pb-8 pt-6 md:px-8 md:pb-10 md:pt-8">
          <form className="flex flex-col gap-5">
            <Input
              variant="login"
              label="Email/Username"
              placeholder="Masukkan email/username"
              className="border-[var(--color-text)]/15 bg-transparent"
            />
            <Input
              variant="login"
              label="Password"
              type="password"
              placeholder="Masukkan password"
              className="border-[var(--color-text)]/15 bg-transparent"
            />

            <div className="mt-3 flex flex-col items-center gap-4">
              <Button className="w-full rounded-full border-[var(--color-text)]/60 bg-[var(--color-cta)] px-6 py-3 text-lg font-bold text-[var(--color-text)] shadow-[0_6px_0_rgba(40,60,99,0.8)] hover:bg-[var(--color-cta)]/90">
                Login
              </Button>

              <p className="text-sm text-[var(--color-text)]/70">Or use</p>

              <Button className="w-full rounded-full border-[var(--color-text)]/60 bg-[var(--color-cta)] px-6 py-3 text-lg font-bold text-[var(--color-text)] shadow-[0_6px_0_rgba(40,60,99,0.8)] hover:bg-[var(--color-cta)]/90">
                <span className="flex items-center gap-2">
                  <img src={GoogleIcon} alt="Google" className="h-5 w-5" />
                  Google
                </span>
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-text)]/80">
            Already have account? <span className="font-bold">Sign up</span>
          </p>
        </section>
      </Card>
    </section>
  );
};

export default LoginPage;
