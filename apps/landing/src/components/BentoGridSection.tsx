import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Camera, BarChart3, Lock } from 'lucide-react';

interface BentoGridSectionProps {
  lang: 'en' | 'am';
  theme: 'dark' | 'light';
}

export const BentoGridSection: React.FC<BentoGridSectionProps> = ({ lang, theme }) => {
  const isDark = theme === 'dark';

  const cards = [
    {
      num: '1',
      icon: <Mic className="w-7 h-7 text-emerald-500" />,
      title: lang === 'en' ? 'Bilingual Voice & Text NLP' : 'በአማርኛ እና በእንግሊዝኛ በድምፅ መመዝገብ',
      desc:
        lang === 'en'
          ? 'Log expenses by sending natural voice notes in Amharic or English, or simply paste bank SMS notifications directly inside Telegram.'
          : 'በአማርኛ ወይም በእንግሊዝኛ የድምፅ መልዕክት ወይም የባንክ SMS በመላክ ወጪዎችዎን በሰከንዶች ውስጥ ይመዝግቡ።',
    },
    {
      num: '2',
      icon: <Camera className="w-7 h-7 text-emerald-500" />,
      title: lang === 'en' ? 'Instant Receipt Camera OCR' : 'የደረሰኝ ፎቶ ካሜራ ንባብ',
      desc:
        lang === 'en'
          ? 'Snap a photo of paper receipts from shops, restaurants, or gas stations. Muday AI automatically extracts amounts, vendor names, and dates.'
          : 'የሱቅ ወይም የሬስቶራንት ደረሰኝ ፎቶ ያንሱ። ሙዳይ AI ሂሳቡን፣ የገዙበትን ቦታ እና ቀኑን በራሱ ይለያል።',
    },
    {
      num: '3',
      icon: <BarChart3 className="w-7 h-7 text-emerald-500" />,
      title: lang === 'en' ? 'Telegram Web Mini App' : 'ቴሌግራም ሚኒ አፕ የቪዥዋል ሪፖርቶች',
      desc:
        lang === 'en'
          ? 'Open rich visual analytics and breakdown dashboards directly inside Telegram without ever downloading an external app.'
          : 'ተጨማሪ አፕሊኬሽን ሳያወርዱ በቴሌግራም ሚኒ አፕ ውስጥ በይነተገናኝ የቪዥዋል ሪፖርቶችን እና ገበታዎችን ይመልከቱ።',
    },
    {
      num: '4',
      icon: <Lock className="w-7 h-7 text-emerald-500" />,
      title: lang === 'en' ? 'Muday AI Privacy Guaranteed' : 'ዜሮ የድምፅ መረጃ ማቆየት እና ምስጢራዊነት',
      desc:
        lang === 'en'
          ? 'Your voice audio data is processed instantly and never retained. Zero data retention architecture ensures your financial privacy.'
          : 'የድምፅ መረጃዎ ወዲያውኑ ከተሰራ በኋላ በቋሚነት አይቀመጥም። ዜሮ ዳታ ማቆየት ሙሉ ምስጢራዊነትዎን ያረጋግጣል።',
    },
  ];

  return (
    <section
      className={`relative md:sticky md:top-0 md:min-h-screen z-10 py-20 flex flex-col justify-center transition-colors duration-300 ${
        isDark ? 'bg-[#050811] text-white' : 'bg-[#f4f4f6] text-slate-900'
      }`}
    >
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 w-full z-10">
        {/* Section Header */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className={`font-general-sans text-3xl sm:text-4xl lg:text-[48px] font-medium tracking-[-1.44px] leading-snug lg:leading-[52.8px] antialiased break-words text-center mb-16 ${
            isDark ? 'text-white' : 'text-[#000000]'
          }`}
          style={{ fontFeatureSettings: '"blwf", "cv03", "cv04", "cv09", "cv11"' }}
        >
          {lang === 'en' ? 'Muday helps you...' : 'ሙዳይ ይረዳዎታል...'}
        </motion.h2>

        {/* 2x2 Bento Grid Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {cards.map((card, idx) => (
            <div
              key={idx}
              className={`p-8 sm:p-10 rounded-[28px] min-h-[260px] sm:min-h-[290px] flex flex-col justify-between ${
                isDark ? 'bg-slate-900/90 shadow-xl shadow-black/50' : 'bg-white shadow-xs'
              }`}
            >
              {/* Top Badge Icon Box */}
              <div className="flex items-center justify-between mb-6">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                >
                  {card.icon}
                </div>
              </div>

              {/* Bottom Title & Description */}
              <div>
                <h3
                  className={`text-xl font-semibold tracking-tight mb-2 ${
                    isDark ? 'text-white' : 'text-[#09090b]'
                  }`}
                >
                  {card.title}
                </h3>
                <p
                  className={`text-sm leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-[#64748b]'
                  }`}
                >
                  {card.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
