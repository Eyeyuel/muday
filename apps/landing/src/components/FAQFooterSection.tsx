import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface FAQFooterSectionProps {
  lang: 'en' | 'am';
  theme: 'dark' | 'light';
}

export const FAQFooterSection: React.FC<FAQFooterSectionProps> = ({ lang, theme }) => {
  const isDark = theme === 'dark';

  return (
    <footer
      id="faq"
      className={`relative pt-24 pb-12 transition-colors duration-300 ${
        isDark ? 'bg-[#050811] text-white' : 'bg-[#f4f4f6] text-slate-900'
      }`}
    >
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 w-full z-10">
        {/* Pre-Footer CTA Section (Sleeker Headline Text + Bigger Button Text) */}
        <div className="max-w-4xl text-left mb-28">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className={`font-general-sans text-3xl sm:text-4xl lg:text-[48px] font-medium tracking-[-1.44px] leading-snug lg:leading-[52.8px] antialiased break-words max-w-3xl mb-8 ${
              isDark ? 'text-white' : 'text-[#000000]'
            }`}
            style={{ fontFeatureSettings: '"blwf", "cv03", "cv04", "cv09", "cv11"' }}
          >
            {lang === 'en' ? (
              <>Use Muday to track smarter, save better, and make every dollar work for you.</>
            ) : (
              <>ሙዳይ AIን በመጠቀም ወጪዎችን በብልሃት ይቆጣጠሩ፣ የተሻለ ይቆጥቡ፣ እና እያንዳንዱን ብር ለወደፊትዎ ይጠቀሙበት።</>
            )}
          </motion.h2>

          {/* Primary Solid Purple Pill Button (Bigger Button Text) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <a
              href="https://t.me/mudayaibot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 nova-pill-mint px-9 py-4 transition-all shadow-lg group"
            >
              <span className="flex items-center gap-2.5 transition-transform duration-300 group-hover:-translate-y-1">
                <span>{lang === 'en' ? 'Start tracking for free' : 'አሁኑኑ በነፃ ይጀምሩ'}</span>
                <span className="flex items-center">→</span>
              </span>
            </a>
          </motion.div>
        </div>

        {/* Professional Multi-Column Footer Grid */}
        <div
          className={`pt-12 md:pt-16 pb-12 border-t flex flex-col md:flex-row justify-between gap-12 ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200/80 text-slate-500'}`}
        >
          {/* Brand & Description */}
          <div className="md:w-1/3 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <img
                src="/muday-logo-transparent.png"
                alt="Muday Logo"
                className="w-8 h-8 object-contain"
              />
              <span
                className={`font-semibold text-xl tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
              >
                Muday AI
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              {lang === 'en'
                ? 'Your smart Telegram companion for effortless expense tracking, SMS receipt parsing, and localized financial insights.'
                : 'ቀላል እና ዘመናዊ የወጪ መቆጣጠሪያ፤ በቴሌግራም ላይ የሚሰራ የፋይናንስ ረዳት።'}
            </p>
            <span className="text-sm font-medium mt-1">contact@muday.ai</span>
          </div>

          {/* Links Columns */}
          <div className="flex gap-16 sm:gap-24 md:gap-32">
            {/* Product Column */}
            <div className="flex flex-col gap-4 text-sm">
              <span
                className={`font-semibold mb-1 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
              >
                {lang === 'en' ? 'Product' : 'አገልግሎት'}
              </span>
              <a href="#features">{lang === 'en' ? 'Features' : 'ባህሪያት'}</a>
              <a href="#how-it-works">{lang === 'en' ? 'How it Works' : 'እንዴት ይሰራል'}</a>
              <a href="#mini-app">{lang === 'en' ? 'Mini App' : 'ሚኒ አፕ'}</a>
              <a href="#faq">{lang === 'en' ? 'FAQ' : 'ጥያቄዎች'}</a>
            </div>

            {/* Legal Column */}
            <div className="flex flex-col gap-4 text-sm">
              <span
                className={`font-semibold mb-1 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
              >
                {lang === 'en' ? 'Legal' : 'ህጋዊ'}
              </span>
              <div
                className={`flex flex-col gap-4 text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
              >
                <Link to="/privacy">{lang === 'en' ? 'Privacy Policy' : 'የግላዊነት ፖሊሲ'}</Link>
                <Link to="/terms">{lang === 'en' ? 'Terms of Use' : 'የአጠቃቀም ውሎች'}</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright Row */}
        <div
          className={`py-6 border-t flex flex-col sm:flex-row items-center justify-between text-xs gap-4 ${isDark ? 'border-white/10 text-slate-500' : 'border-slate-200/80 text-slate-400'}`}
        >
          <div className="shrink-0">
            <span>
              © {new Date().getFullYear()} Muday AI.{' '}
              {lang === 'en' ? 'All rights reserved.' : 'መብቱ በህግ የተጠበቀ ነው።'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span>{lang === 'en' ? 'Made in Ethiopia' : 'በኢትዮጵያ የተሰራ'}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
