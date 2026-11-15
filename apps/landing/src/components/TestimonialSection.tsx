import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TestimonialSectionProps {
  lang: 'en' | 'am';
  theme: 'dark' | 'light';
}

export const TestimonialSection: React.FC<TestimonialSectionProps> = ({ lang, theme }) => {
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState(0);

  const testimonials = [
    {
      id: 0,
      name: 'Kaleb M.',
      nameAm: 'ካሌብ መ.',
      date: 'May 16, 2025',
      dateAm: 'ግንቦት 08፣ 2017',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      quoteEn:
        '“Logging expenses used to be a chore. Now I just hold the mic on Telegram and say what I bought in Amharic. Muday is magic.”',
      quoteAm:
        '“ወጪ መመዝገብ በጣም አሰልቺ ነበር። አሁን ግን ቴሌግራም ላይ ማይኩን ተጭኜ በአማርኛ የገዛሁትን እናገራለሁ። ሙዳይ በጣም አስገራሚ ነው።”',
    },
    {
      id: 1,
      name: 'Sara Y.',
      nameAm: 'ሳራ ዮ.',
      date: 'May 12, 2025',
      dateAm: 'ግንቦት 04፣ 2017',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      quoteEn:
        '“The Telegram Web Mini App visual charts give me instant clarity on my monthly spending. It’s so much faster than opening a separate banking app.”',
      quoteAm: '“የቴሌግራም ሚኒ አፕ ገበታዎች በየወሩ ወጪዬን በግልጽ ያሳዩኛል። የተለየ አፕ ከፍቶ ከማየት እጅግ በጣም ፈጣን ነው።”',
    },
    {
      id: 2,
      name: 'Eyob T.',
      nameAm: 'እዮብ ተ.',
      date: 'April 28, 2025',
      dateAm: 'ሚያዝያ 20፣ 2017',
      avatar:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      quoteEn:
        '“Sending bank SMS notifications directly to the bot is a game changer. It categorizes my CBE and Telebirr transactions flawlessly.”',
      quoteAm:
        '“የባንክ SMS መልዕክቶችን በቀጥታ ለቦቱ መላክ ትልቅ ለውጥ አምጥቶልኛል። የCBE እና ቴሌብር ዝውውሮቼን ያለምንም ስህተት ይመድባቸዋል።”',
    },
    {
      id: 3,
      name: 'Lulit B.',
      nameAm: 'ሉሊት ብ.',
      date: 'April 20, 2025',
      dateAm: 'ሚያዝያ 12፣ 2017',
      avatar:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      quoteEn:
        '“Receipt camera scanning is insanely fast. I just snap paper receipts from supermarkets, and Muday logs the exact amounts instantly.”',
      quoteAm: '“የደረሰኝ ፎቶ ካሜራ ንባቡ በጣም ፈጣን ነው። የሱፐርማርኬት ደረሰኝ ፎቶ ስነሳ ሂሳቡን ወዲያውኑ ይመዘግበዋል።”',
    },
  ];

  const current = testimonials[activeTab];

  return (
    <section
      className={`relative pt-36 pb-40 transition-colors duration-300 ${
        isDark ? 'bg-[#050811] text-white' : 'bg-[#f4f4f6] text-[#09090b]'
      }`}
    >
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 w-full z-10 text-left">
        {/* Large Testimonial Quote */}
        <div className="min-h-[220px] flex flex-col justify-center mb-10">
          <AnimatePresence mode="wait">
            <motion.p
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className={`font-general-sans text-[39px] font-medium tracking-[-1.17px] leading-[46.8px] antialiased break-words text-left max-w-4xl ${
                isDark ? 'text-white' : 'text-[#09090b]'
              }`}
              style={{ fontFeatureSettings: '"blwf", "cv03", "cv04", "cv09", "cv11"' }}
            >
              {lang === 'en' ? current.quoteEn : current.quoteAm}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Author Avatar & Metadata Row (Explicit Contrast in Light/Dark) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-4 mb-16"
          >
            <div
              className={`w-14 h-14 shrink-0 rounded-full shadow-sm border flex items-center justify-center text-xl font-bold font-general-sans transition-colors ${
                isDark
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
              }`}
            >
              {(lang === 'en' ? current.name : current.nameAm).charAt(0)}
            </div>
            <div>
              <h4
                className={`text-lg font-semibold tracking-tight leading-snug ${
                  isDark ? 'text-white' : 'text-[#09090b]'
                }`}
              >
                {lang === 'en' ? current.name : current.nameAm}
              </h4>
              <span
                className={`text-sm font-normal ${isDark ? 'text-slate-400' : 'text-[#64748b]'}`}
              >
                {lang === 'en' ? current.date : current.dateAm}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Bottom 4-Segment Card Tab Bar (Exact Light/Dark Theme Match) */}
        <div
          className={`rounded-2xl overflow-hidden grid grid-cols-2 sm:grid-cols-4 max-w-3xl border bg-transparent ${
            isDark ? 'border-white/10' : 'border-slate-300/80'
          }`}
        >
          {testimonials.map((item, idx) => {
            const isSelected = activeTab === idx;
            return (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={`relative py-6 px-6 sm:py-8 sm:px-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                  isSelected
                    ? isDark
                      ? 'bg-[#1e293b] shadow-md'
                      : 'bg-[#e4e4e7] shadow-md'
                    : isDark
                      ? 'hover:bg-[#1e293b] text-slate-400'
                      : 'hover:bg-[#e4e4e7] text-[#3f3f46]'
                }`}
              >
                <span
                  className={`text-sm sm:text-base font-semibold block tracking-tight ${
                    isSelected
                      ? isDark
                        ? 'text-white font-bold'
                        : 'text-[#09090b] font-bold'
                      : isDark
                        ? 'text-slate-300 font-medium'
                        : 'text-[#27272a] font-medium'
                  }`}
                >
                  {lang === 'en' ? item.name : item.nameAm}
                </span>
                <span
                  className={`text-xs block mt-1 font-normal ${
                    isSelected
                      ? isDark
                        ? 'text-slate-300'
                        : 'text-[#3f3f46]'
                      : isDark
                        ? 'text-slate-500'
                        : 'text-[#71717a]'
                  }`}
                >
                  {lang === 'en' ? item.date : item.dateAm}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
