import React from 'react';
import { HeroSection } from '../components/HeroSection';
import { SocialProofSection } from '../components/SocialProofSection';
import { BentoGridSection } from '../components/BentoGridSection';
import { DarkPocketSection } from '../components/DarkPocketSection';
import { StepDetailSection } from '../components/StepDetailSection';
import { TestimonialSection } from '../components/TestimonialSection';

interface HomeProps {
  lang: 'en' | 'am';
  theme: 'dark' | 'light';
}

export const Home: React.FC<HomeProps> = ({ lang, theme }) => {
  return (
    <>
      {/* Hero Section & 3D Visual Centerpiece (Phase 3) */}
      <HeroSection lang={lang} theme={theme} />

      {/* Statement Intro & Floating Glass Cards (Phase 4) */}
      <SocialProofSection lang={lang} theme={theme} />

      {/* Sticky Stacking Reveal Container */}
      <div className="relative">
        {/* 4-Card Bento Grid ("Muday helps you...") (Phase 5: Sticky Top-0) */}
        <BentoGridSection lang={lang} theme={theme} />

        {/* High-Contrast Pure Black Pocket Section (Phase 6: Overlaps On Top at z-20) */}
        <DarkPocketSection lang={lang} theme={theme} />
      </div>

      {/* Step-by-Step Process Rows 01, 02, 03 (Phase 7) */}
      <StepDetailSection lang={lang} theme={theme} />

      {/* Testimonial Section with 4-Segment Tab Bar (Phase 8) */}
      <TestimonialSection lang={lang} theme={theme} />
    </>
  );
};

export default Home;
