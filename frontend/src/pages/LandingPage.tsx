import BenefitSection from "../components/landing/BenefitSection";
import HeroSection from "../components/landing/HeroSection";
import StepsSection from "../components/landing/StepsSection";

const LandingPage = () => {
  return (
    <section className="space-y-6 py-10 flex flex-col">
      {/* hero section */}
      <HeroSection />
      {/* benefit section */}
      <section>
        <BenefitSection />
      </section>
      {/* steps section */}
      <section>
        <StepsSection />
      </section>
    </section>
  );
};

export default LandingPage;
