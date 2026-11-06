import { FaqSection, FinalCtaSection, SiteFooter } from "@/components/landing/Closing";
import { FeaturesSection } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import {
  BenefitsSection,
  HowItWorksSection,
  RolesSection,
} from "@/components/landing/OrgSections";
import { PricingSection } from "@/components/landing/Pricing";
import { ShowcaseSection } from "@/components/landing/Showcase";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ComparisonSection, TrustSection } from "@/components/landing/ValueSections";


export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="w-full pt-20 bg-surface-container-lowest min-h-screen text-on-surface">
        <Hero />
        <TrustSection />
        <ComparisonSection />
        <FeaturesSection />
        <ShowcaseSection />
        <HowItWorksSection />
        <BenefitsSection />
        <RolesSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
