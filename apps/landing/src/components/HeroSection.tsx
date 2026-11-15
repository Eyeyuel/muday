import React, { useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, animate } from 'framer-motion';
import { Sparkles, Bell, ArrowUpRight } from 'lucide-react';

const AnimatedNumber = ({
  value,
  suffix = '',
  prefix = '',
}: {
  value: number;
  suffix?: string;
  prefix?: string;
}) => {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (node) {
      const controls = animate(0, value, {
        duration: 2,
        ease: 'easeOut',
        onUpdate(v) {
          node.textContent =
            prefix +
            v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
            suffix;
        },
      });
      return () => controls.stop();
    }
  }, [value, suffix, prefix]);

  return (
    <span ref={nodeRef}>
      {prefix}0.00{suffix}
    </span>
  );
};

interface HeroSectionProps {
  lang: 'en' | 'am';
  theme: 'dark' | 'light';
}

export const HeroSection: React.FC<HeroSectionProps> = ({ lang, theme }) => {
  const isDark = theme === 'dark';
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  // Move up significantly when scrolling down, and down when scrolling up
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -250]);

  return (
    <section
      ref={sectionRef}
      className={`relative pt-48 pb-0 overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-[#050811] text-white' : 'bg-[#f4f4f6] text-slate-900'
      }`}
    >
      {/* Background Soft Purple Glow Accent */}
      <div className="pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-600/10 rounded-full blur-[120px] z-0" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center z-10">
        {/* Top Tag Link (Hovers to 100% Solid Black in all themes) */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 mb-6"
        >
          <a
            href="https://t.me/mudayaibot"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 text-xs sm:text-sm font-mono font-bold tracking-widest text-[#64748b] dark:text-slate-400 uppercase hover:text-black dark:hover:text-black transition-colors bg-transparent border-0 shadow-none p-0"
          >
            <span>
              {lang === 'en'
                ? 'MUDAY AI-POWERED FINANCIAL TRACKING ON TELEGRAM'
                : 'ሙዳይ አርቴፊሻል ኢንተለጀንስ የገንዘብ መቆጣጠሪያ በቴሌግራም'}
            </span>
            <span className="text-base font-normal">→</span>
          </a>
        </motion.div>

        {/* Headline Title (Exact 68px, 500 weight, -2.72px tracking, General Sans styles) */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`font-general-sans text-4xl sm:text-6xl lg:text-[68px] font-medium tracking-[-2.72px] leading-tight sm:leading-[68px] max-w-[872px] mx-auto antialiased break-words ${
            isDark ? 'text-white' : 'text-[#000000]'
          }`}
          style={{ fontFeatureSettings: '"blwf", "cv03", "cv04", "cv09", "cv11"' }}
        >
          {lang === 'en' ? (
            <>
              Track every transaction <br className="hidden sm:inline" />
              instantly in one place
            </>
          ) : (
            <>
              ገንዘብዎን በእጅዎ፡ <br className="hidden sm:inline" />
              በግልጽ ይመዝግቡ
            </>
          )}
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={`mt-6 text-base sm:text-lg lg:text-xl font-normal max-w-xl mx-auto leading-normal ${
            isDark ? 'text-slate-400' : 'text-[#64748b]'
          }`}
        >
          {lang === 'en' ? (
            <>
              Muday helps you budget smarter, track spending, <br className="hidden sm:inline" />
              and build wealth, all in one place.
            </>
          ) : (
            <>
              ሙዳይ ወጪዎችዎን በቀላሉ እንዲቆጣጠሩ፣ <br className="hidden sm:inline" />
              እና ሀብትዎን እንዲያሳድጉ ይረዳዎታል።
            </>
          )}
        </motion.p>

        {/* Primary Nova Purple Pill Button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex justify-center items-center"
        >
          <a
            href="https://t.me/mudayaibot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 nova-pill-mint px-7 py-3 transition-all shadow-md group"
          >
            <span className="flex items-center gap-2 transition-transform duration-300 group-hover:-translate-y-1">
              <span>{lang === 'en' ? 'Start tracking for free' : 'አሁኑኑ በነፃ ይጀምሩ'}</span>
              <span className="flex items-center">→</span>
            </span>
          </a>
        </motion.div>

        {/* Hero Visual Composition */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-10 relative mx-auto max-w-4xl flex items-center justify-center pt-4"
        >
          {/* Left 3D Jackstar (Parallax) */}
          <motion.div
            style={{ y: yParallax }}
            className="hidden md:block absolute left-6 sm:left-14 lg:left-10 top-6 z-0 w-44 sm:w-64 md:w-[320px] pointer-events-none"
          >
            <img
              src="/assets/pic1.webp"
              alt="3D Purple Jackstar Sculpture"
              className="w-full h-auto object-contain"
            />
          </motion.div>

          {/* Smartphone Mockup Frame Container */}
          <div className="relative z-10 w-64 sm:w-80 md:w-[380px] flex justify-center">
            {/* Full Phone Glass Silhouette */}
            <div className="absolute inset-0 rounded-[45px] sm:rounded-[55px] md:rounded-[60px] bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl z-0" />

            {/* Native Phone Frame */}
            <img
              src="/assets/phone.avif"
              alt="Muday Telegram Phone Mockup"
              className="w-full h-auto object-contain relative z-10"
            />

            {/* Screen UI Overlay (Content) */}
            <div
              className={`absolute inset-x-[6.5%] top-[2.8%] bottom-[4.5%] z-20 rounded-[32px] p-3 sm:p-4 pt-2 overflow-hidden text-left flex flex-col justify-start transition-colors ${
                isDark ? 'bg-transparent text-white' : 'bg-transparent text-slate-900'
              }`}
            >
              {/* Top Dynamic Island Notch */}
              <div className="mx-auto w-[30%] h-3.5 bg-black rounded-full shrink-0 mb-1.5" />

              {/* Avatar & Header Row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-900 flex items-center justify-center text-white text-[10px] font-bold border border-emerald-400">
                    M
                  </div>
                  <span
                    className={`text-[11px] font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    Hello,{' '}
                    <strong className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {lang === 'en' ? 'Mary' : 'አበበ'}
                    </strong>
                  </span>
                </div>
                <div
                  className={`flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <Bell className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Amount Saved */}
              <div className="mb-2">
                <div
                  className={`flex items-center justify-between text-[10px] font-normal mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                >
                  <span>Amount saved</span>
                  <div className="flex items-center gap-1.5">
                    <span className="bg-[#10b981] text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                      FOR GOALS
                    </span>
                    <span className="text-[#10b981] text-[8px] font-bold uppercase">EMERGENCY</span>
                  </div>
                </div>
                <div
                  className={`flex items-baseline gap-1.5 border-b pb-1.5 ${isDark ? 'border-slate-800' : 'border-slate-300/40'}`}
                >
                  <span
                    className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono ${isDark ? 'text-white' : 'text-slate-950'}`}
                  >
                    <AnimatedNumber value={45680.5} suffix={lang === 'en' ? ' ETB' : ' ብር'} />
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Last month Section */}
              <div className="mb-2">
                <span
                  className={`text-[10px] font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  {lang === 'en' ? 'Last month' : 'ያለፈው ወር'}
                </span>
                <div className="grid grid-cols-2 gap-2 mb-1.5">
                  <div
                    className={`backdrop-blur-md p-2 sm:p-2.5 rounded-xl border shadow-sm ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white/40 border-white/60'}`}
                  >
                    <span
                      className={`text-[9px] block mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}
                    >
                      {lang === 'en' ? 'Income' : 'ገቢ'}
                    </span>
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono block ${isDark ? 'text-white' : 'text-slate-900'}`}
                    >
                      <AnimatedNumber value={125230.0} suffix={lang === 'en' ? ' ETB' : ' ብር'} />
                    </span>
                  </div>
                  <div
                    className={`backdrop-blur-md p-2 sm:p-2.5 rounded-xl border shadow-sm ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white/40 border-white/60'}`}
                  >
                    <span
                      className={`text-[9px] block mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}
                    >
                      {lang === 'en' ? 'Expense' : 'ወጪ'}
                    </span>
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono block ${isDark ? 'text-white' : 'text-slate-900'}`}
                    >
                      <AnimatedNumber value={84895.0} suffix={lang === 'en' ? ' ETB' : ' ብር'} />
                    </span>
                  </div>
                </div>
                <div
                  className={`backdrop-blur-md px-2.5 py-1 rounded-lg border flex items-center justify-between text-[10px] shadow-sm ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white/50 border-white/60'}`}
                >
                  <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {lang === 'en' ? 'Savings' : 'ቁጠባ'}
                  </span>
                  <span className="font-bold font-mono text-emerald-600 flex items-center gap-0.5">
                    <AnimatedNumber value={40335.0} suffix={lang === 'en' ? ' ETB' : ' ብር'} />{' '}
                    <ArrowUpRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>

              {/* Boost your savings with AI Banner */}
              <div className="bg-[#10b981] text-white px-3 py-2 rounded-xl mb-2 flex items-center justify-between shadow-xs">
                <span className="text-[10px] sm:text-[11px] font-medium tracking-tight">
                  {lang === 'en' ? 'Boost your savings with AI' : 'ቁጠባዎን በ AI ያሳድጉ'}
                </span>
                <div className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1">
                  <span>{lang === 'en' ? 'Analyse' : 'ትንተና'}</span>
                  <Sparkles className="w-2.5 h-2.5" />
                </div>
              </div>

              {/* My Goals Section */}
              <div>
                <span
                  className={`text-[10px] font-semibold block px-0.5 mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  {lang === 'en' ? 'My goals' : 'የእኔ ግቦች'}
                </span>

                {/* Vacation to Bali Card with Circular Progress Gauge */}
                <div
                  className={`backdrop-blur-md p-2.5 rounded-2xl border shadow-sm flex items-center justify-between ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white/40 border-white/60'}`}
                >
                  <div>
                    <span
                      className={`text-[9px] font-semibold block mb-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}
                    >
                      {lang === 'en' ? 'Vacation to Bali' : 'የእረፍት ጊዜ ቁጠባ'}
                    </span>
                    <span
                      className={`text-base sm:text-lg font-extrabold font-mono tracking-tight block ${isDark ? 'text-white' : 'text-slate-950'}`}
                    >
                      <AnimatedNumber value={220360.0} suffix={lang === 'en' ? ' ETB' : ' ብር'} />
                    </span>
                    <span
                      className={`text-[8px] block mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}
                    >
                      {lang === 'en' ? 'by Nov. 2025' : 'እስከ ኅዳር 2018'}
                    </span>
                  </div>
                  {/* Circular Progress Gauge */}
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className={isDark ? 'text-slate-700' : 'text-slate-100'}
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-amber-500"
                        strokeDasharray="72, 100"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span
                      className={`absolute text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                    >
                      ✈️
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right 3D Ribbed Sphere (Parallax) */}
          <motion.div
            style={{ y: yParallax }}
            className="hidden md:block absolute right-4 sm:right-10 lg:right-8 bottom-32 sm:bottom-40 md:bottom-48 z-0 w-44 sm:w-64 md:w-[320px] pointer-events-none"
          >
            <img
              src="/assets/pic2.webp"
              alt="3D Purple Ribbed Sphere Sculpture"
              className="w-full h-auto object-contain"
            />
          </motion.div>
        </motion.div>
      </div>

      {/* Bank & Partner Logo Ticker Section with Thin Top Border & Higher Overlap */}
      <div
        className={`relative z-20 -mt-24 sm:-mt-32 md:-mt-40 pt-12 pb-16 text-center border-t transition-colors duration-300 ${
          isDark
            ? 'bg-[#050811] border-white/10 text-white'
            : 'bg-[#f4f4f6] border-slate-200/90 text-slate-900'
        }`}
      >
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium mb-10 tracking-tight">
          {lang === 'en'
            ? 'Compatible with SMS from:'
            : 'ከእነዚህ ባንኮች በሚመጡ አጫጭር የጽሁፍ መልዕክቶች (SMS) ይሰራል፡'}
        </p>

        {/* Infinite Rotating Bank Logos Marquee */}
        <div className="relative overflow-hidden w-full max-w-6xl mx-auto px-4 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          <div className="animate-marquee-infinite flex items-center gap-10 sm:gap-14 md:gap-18 py-2">
            {[
              {
                name: 'Commercial Bank of Ethiopia',
                logo: '/bank_logos/Commercial Bank of Ethiopia Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[50px] sm:max-w-[60px]',
              },
              {
                name: 'Telebirr',
                logo: '/bank_logos/TeleBirr Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[55px] sm:max-w-[65px]',
              },
              {
                name: 'Awash Bank',
                logo: '/bank_logos/Awash International Bank ( No text ) Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[55px] sm:max-w-[65px]',
              },
              {
                name: 'Dashen Bank',
                logo: '/bank_logos/Dashen Bank Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[55px] sm:max-w-[65px]',
              },
              {
                name: 'Bank of Abyssinia',
                logo: '/bank_logos/Bank of Abyssinia Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[130px] sm:max-w-[160px]',
              },
              {
                name: 'Wegagen Bank',
                logo: '/bank_logos/Wegagen Bank Logo.svg',
                className: 'h-7 sm:h-8 md:h-9 w-auto max-w-[120px] sm:max-w-[140px]',
              },
              {
                name: 'Cooperative Bank of Oromia',
                logo: '/bank_logos/Cooperative Bank of Oromia Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[130px] sm:max-w-[150px]',
              },
              {
                name: 'Hibret Bank',
                logo: '/bank_logos/Hibret Bank ( No text ) Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[55px] sm:max-w-[65px]',
              },
              {
                name: 'Zemen Bank',
                logo: '/bank_logos/Zemen Bank Logo.svg',
                className: 'h-7 sm:h-8 md:h-9 w-auto max-w-[110px] sm:max-w-[130px]',
              },
              // Duplicate set 1 for seamless infinite loop
              {
                name: 'Commercial Bank of Ethiopia',
                logo: '/bank_logos/Commercial Bank of Ethiopia Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[50px] sm:max-w-[60px]',
              },
              {
                name: 'Telebirr',
                logo: '/bank_logos/TeleBirr Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[55px] sm:max-w-[65px]',
              },
              {
                name: 'Awash Bank',
                logo: '/bank_logos/Awash International Bank ( No text ) Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[55px] sm:max-w-[65px]',
              },
              {
                name: 'Dashen Bank',
                logo: '/bank_logos/Dashen Bank Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[55px] sm:max-w-[65px]',
              },
              {
                name: 'Bank of Abyssinia',
                logo: '/bank_logos/Bank of Abyssinia Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[130px] sm:max-w-[160px]',
              },
              {
                name: 'Wegagen Bank',
                logo: '/bank_logos/Wegagen Bank Logo.svg',
                className: 'h-7 sm:h-8 md:h-9 w-auto max-w-[120px] sm:max-w-[140px]',
              },
              {
                name: 'Cooperative Bank of Oromia',
                logo: '/bank_logos/Cooperative Bank of Oromia Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[130px] sm:max-w-[150px]',
              },
              {
                name: 'Hibret Bank',
                logo: '/bank_logos/Hibret Bank ( No text ) Logo.svg',
                className: 'h-8 sm:h-10 md:h-11 w-auto max-w-[55px] sm:max-w-[65px]',
              },
              {
                name: 'Zemen Bank',
                logo: '/bank_logos/Zemen Bank Logo.svg',
                className: 'h-7 sm:h-8 md:h-9 w-auto max-w-[110px] sm:max-w-[130px]',
              },
            ].map((bank, idx) => (
              <div
                key={idx}
                className="flex items-center grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-200 cursor-pointer shrink-0"
                title={bank.name}
              >
                <img
                  src={bank.logo}
                  alt={bank.name}
                  className={`${bank.className} object-contain`}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
