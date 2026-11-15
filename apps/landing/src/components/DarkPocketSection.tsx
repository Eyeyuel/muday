import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, RotateCw } from 'lucide-react';

interface DarkPocketSectionProps {
  lang: 'en' | 'am';
  theme: 'dark' | 'light';
}

export const DarkPocketSection: React.FC<DarkPocketSectionProps> = ({ lang, theme }) => {
  const [activeTab, setActiveTab] = useState<'banks' | 'autocat' | 'ai'>('banks');

  // The user requested the OPPOSITE theme for this section
  const isSectionDark = theme === 'light';

  const tabs = [
    {
      id: 'banks' as const,
      title: lang === 'en' ? 'Bank SMS Parsing' : 'የባንክ SMS መልዕክቶች',
      subtitle:
        lang === 'en'
          ? 'Forward bank SMS notifications to track instantly.'
          : 'ወጪዎችን ለመመዝገብ የባንክ መልዕክቶችን (SMS) በቀጥታ ይላኩ።',
    },
    {
      id: 'autocat' as const,
      title: lang === 'en' ? 'Auto-categorised' : 'ራስ-ሰር ምደባ',
      subtitle:
        lang === 'en'
          ? 'All your transactions will be safely sorted instantly.'
          : 'ሁሉም ዝውውሮችዎ ወዲያውኑ ይመደባሉ።',
    },
    {
      id: 'ai' as const,
      title: lang === 'en' ? 'Amharic Voice AI' : 'የአማርኛ ድምፅ ትዕዛዝ',
      subtitle:
        lang === 'en'
          ? 'Log expenses simply by speaking naturally in Amharic.'
          : 'በአማርኛ ድምፅ በመላክ ብቻ ወጪዎችዎን ይመዝግቡ።',
    },
  ];

  return (
    <section
      id="mini-app"
      className={`relative z-20 py-24 sm:py-32 overflow-hidden rounded-t-[40px] sm:rounded-t-[64px] transition-colors duration-300 ${
        isSectionDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-slate-900'
      }`}
    >
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 w-full z-10 text-left">
        {/* Main Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className={`font-general-sans text-3xl sm:text-4xl lg:text-[48px] font-medium tracking-[-1.44px] leading-snug lg:leading-[52.8px] antialiased break-words max-w-2xl mb-12 sm:mb-16 transition-colors duration-300 ${
            isSectionDark ? 'text-white' : 'text-[#000000]'
          }`}
          style={{ fontFeatureSettings: '"blwf", "cv03", "cv04", "cv09", "cv11"' }}
        >
          {lang === 'en' ? (
            <>
              Track everything you <br />
              need in your pocket.
            </>
          ) : (
            <>
              የሚፈልጉትን ሁሉ <br />
              በኪስዎ ይከታተሉ።
            </>
          )}
        </motion.h2>

        {/* 3 Horizontal Feature Selection Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative p-3 sm:p-4 rounded-[20px] text-left transition-all duration-300 cursor-pointer ${
                  !isSelected
                    ? isSectionDark
                      ? 'hover:bg-white/[0.02]'
                      : 'hover:bg-black/[0.02]'
                    : ''
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className={`absolute inset-0 rounded-[20px] ${
                      isSectionDark
                        ? 'bg-[#18181B] shadow-[0_4_30px_rgba(0,0,0,0.5)]'
                        : 'bg-[#ffffff] shadow-[0_4_30px_rgba(0,0,0,0.05)]'
                    }`}
                    initial={false}
                    transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                  />
                )}
                <div className="relative z-10">
                  <h3
                    className={`font-general-sans text-[19px] font-medium tracking-[-0.38px] leading-[24.7px] antialiased break-words block mb-1 transition-colors duration-300 ${
                      isSelected
                        ? isSectionDark
                          ? 'text-white'
                          : 'text-slate-900'
                        : isSectionDark
                          ? 'text-[#A1A1AA] group-hover:text-white'
                          : 'text-slate-500 group-hover:text-slate-900'
                    }`}
                    style={{ fontFeatureSettings: '"blwf", "cv03", "cv04", "cv09", "cv11"' }}
                  >
                    {tab.title}
                  </h3>
                  <p
                    className={`font-general-sans text-[19px] font-normal tracking-[-0.38px] leading-[24.7px] antialiased break-words transition-colors ${
                      isSelected
                        ? isSectionDark
                          ? 'text-white/[0.56]'
                          : 'text-black/[0.56]'
                        : isSectionDark
                          ? 'text-white/[0.35]'
                          : 'text-black/[0.35]'
                    }`}
                    style={{ fontFeatureSettings: '"blwf", "cv03", "cv04", "cv09", "cv11"' }}
                  >
                    {tab.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Fixed Height Big Card Container */}
        <div
          className={`border rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 md:p-12 h-[680px] sm:h-[500px] flex flex-col justify-center overflow-hidden relative transition-colors duration-300 ${
            isSectionDark
              ? 'bg-[#09090B] border-white/[0.05] shadow-2xl'
              : 'bg-[#F8F9FA] border-black/[0.05] shadow-xl'
          }`}
        >
          <AnimatePresence mode="wait">
            {/* TAB 1: Bank accounts */}
            {activeTab === 'banks' && (
              <motion.div
                key="banks"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="h-full flex flex-col justify-center text-center w-full"
              >
                <p
                  className={`font-general-sans text-[19px] font-normal tracking-[-0.38px] leading-[24.7px] antialiased break-words text-center mb-10 transition-colors ${
                    isSectionDark ? 'text-white' : 'text-slate-900'
                  }`}
                  style={{ fontFeatureSettings: '"blwf", "cv03", "cv04", "cv09", "cv11"' }}
                >
                  {lang === 'en'
                    ? 'Supports automated SMS extraction for 20+ local banks & wallets'
                    : 'ከ20 በላይ ከሆኑ የሀገር ውስጥ ባንኮች እና ዋሌቶች ለሚመጡ አጫጭር መልዕክቶች (SMS) ይሰራል'}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 my-auto w-full max-w-4xl mx-auto px-2 py-2">
                  {[
                    {
                      name: 'Commercial Bank of Ethiopia',
                      logo: '/bank_logos/Commercial Bank of Ethiopia Logo.svg',
                      className: 'h-8 sm:h-9 max-w-[50px] sm:max-w-[60px]',
                    },
                    {
                      name: 'Telebirr',
                      logo: '/bank_logos/TeleBirr Logo.svg',
                      className: 'h-8 sm:h-9 max-w-[55px] sm:max-w-[65px]',
                    },
                    {
                      name: 'Awash Bank',
                      logo: '/bank_logos/Awash International Bank ( No text ) Logo.svg',
                      className: 'h-8 sm:h-9 max-w-[55px] sm:max-w-[65px]',
                    },
                    {
                      name: 'Dashen Bank',
                      logo: '/bank_logos/Dashen Bank Logo.svg',
                      className: 'h-8 sm:h-9 max-w-[55px] sm:max-w-[65px]',
                    },
                    {
                      name: 'Bank of Abyssinia',
                      logo: '/bank_logos/Bank of Abyssinia Logo.svg',
                      className: 'h-8 sm:h-9 max-w-[120px] sm:max-w-[140px]',
                    },
                    {
                      name: 'Wegagen Bank',
                      logo: '/bank_logos/Wegagen Bank Logo.svg',
                      className: 'h-7 sm:h-8 max-w-[110px] sm:max-w-[130px]',
                    },
                    {
                      name: 'Cooperative Bank of Oromia',
                      logo: '/bank_logos/Cooperative Bank of Oromia Logo.svg',
                      className: 'h-8 sm:h-9 max-w-[120px] sm:max-w-[140px]',
                    },
                    {
                      name: 'Hibret Bank',
                      logo: '/bank_logos/Hibret Bank ( No text ) Logo.svg',
                      className: 'h-8 sm:h-9 max-w-[55px] sm:max-w-[65px]',
                    },
                    {
                      name: 'Zemen Bank',
                      logo: '/bank_logos/Zemen Bank Logo.svg',
                      className: 'h-7 sm:h-8 max-w-[100px] sm:max-w-[120px]',
                    },
                  ].map((bank, i) => (
                    <div
                      key={`bank-${i}`}
                      title={bank.name}
                      className={`flex items-center justify-center px-5 sm:px-6 py-3.5 sm:py-4 rounded-[16px] sm:rounded-[20px] min-h-[60px] sm:min-h-[68px] transition-all duration-200 ${
                        isSectionDark
                          ? 'bg-[#18181B] border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
                          : 'bg-white border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
                      }`}
                    >
                      <img
                        src={bank.logo}
                        alt={bank.name}
                        className={`${bank.className} w-auto object-contain ${
                          isSectionDark ? 'brightness-105' : ''
                        }`}
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-12">
                  <a
                    href="https://t.me/mudayaibot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`font-general-sans text-[16px] font-normal tracking-[-0.32px] leading-[20.8px] antialiased transition-colors duration-200 ease-in-out cursor-pointer ${
                      isSectionDark
                        ? 'text-white/95 hover:text-white'
                        : 'text-slate-900/95 hover:text-black'
                    }`}
                    style={{ fontFeatureSettings: '"blwf", "cv03", "cv04", "cv09", "cv11"' }}
                  >
                    {lang === 'en'
                      ? "Reach out if your bank can't be found"
                      : 'ባንክዎ ካልተገኘ እባክዎን ያግኙን'}
                  </a>
                </div>
              </motion.div>
            )}

            {/* TAB 2: Auto-categorised */}
            {activeTab === 'autocat' && (
              <motion.div
                key="autocat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="h-full flex flex-col md:flex-row gap-10 md:gap-16 items-center justify-between w-full"
              >
                {/* Left Title */}
                <div className="md:w-1/2 text-left w-full">
                  <h3
                    className={`font-general-sans text-[36px] sm:text-[44px] font-medium tracking-tight leading-[1.05] transition-colors ${
                      isSectionDark ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {lang === 'en' ? (
                      <>
                        Filter by <br /> category & time
                      </>
                    ) : (
                      <>
                        በምድብ እና <br /> በጊዜ ይለዩ
                      </>
                    )}
                  </h3>
                </div>

                {/* Right Transaction Cards Stack */}
                <div className="md:w-1/2 w-full max-w-md">
                  {/* Starbucks */}
                  <div
                    className={`flex items-center justify-between py-4 border-b ${isSectionDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-[52px] h-[52px] rounded-[18px] bg-[#006241] flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-current">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-12h2v3h-2zm0 5h2v2h-2z" />
                        </svg>
                      </div>
                      <div>
                        <span
                          className={`font-medium text-[15px] sm:text-base block mb-0.5 ${isSectionDark ? 'text-white' : 'text-slate-900'}`}
                        >
                          Tomoca Coffee
                        </span>
                        <span
                          className={`text-[10px] sm:text-[11px] font-mono tracking-wider ${isSectionDark ? 'text-[#A1A1AA]' : 'text-slate-500'}`}
                        >
                          FOOD & DRINKS &nbsp;&nbsp; MAY 22
                        </span>
                      </div>
                    </div>
                    <span className="text-[15px] sm:text-base font-medium text-[#FF453A]">
                      -150.00 ETB
                    </span>
                  </div>

                  {/* Netflix */}
                  <div
                    className={`flex items-center justify-between py-4 border-b ${isSectionDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-[52px] h-[52px] rounded-[18px] border flex items-center justify-center ${
                          isSectionDark
                            ? 'bg-[#141414] border-white/[0.05]'
                            : 'bg-[#ffffff] border-black/[0.05]'
                        }`}
                      >
                        <span className="font-black text-2xl text-[#E50914] tracking-tighter">
                          N
                        </span>
                      </div>
                      <div>
                        <span
                          className={`font-medium text-[15px] sm:text-base block mb-0.5 ${isSectionDark ? 'text-white' : 'text-slate-900'}`}
                        >
                          DSTV
                        </span>
                        <span
                          className={`text-[10px] sm:text-[11px] font-mono tracking-wider ${isSectionDark ? 'text-[#A1A1AA]' : 'text-slate-500'}`}
                        >
                          ENTERTAINMENT &nbsp;&nbsp; MAY 19
                        </span>
                      </div>
                    </div>
                    <span className="text-[15px] sm:text-base font-medium text-[#FF453A]">
                      -650.00 ETB
                    </span>
                  </div>

                  {/* May salary */}
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-[52px] h-[52px] rounded-[18px] border flex items-center justify-center ${
                          isSectionDark
                            ? 'bg-[#18181B] border-white/[0.05] text-white'
                            : 'bg-[#ffffff] border-black/[0.05] text-slate-800'
                        }`}
                      >
                        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                          <path d="M12 2A10 10 0 1022 12 10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8z" />
                          <path d="M12 6a6 6 0 106 6 6 6 0 00-6-6zm0 10a4 4 0 114-4 4 4 0 01-4 4z" />
                        </svg>
                      </div>
                      <div>
                        <span
                          className={`font-medium text-[15px] sm:text-base block mb-0.5 ${isSectionDark ? 'text-white' : 'text-slate-900'}`}
                        >
                          {lang === 'en' ? 'May salary' : 'የግንቦት ደመወዝ'}
                        </span>
                        <span
                          className={`text-[10px] sm:text-[11px] font-mono tracking-wider ${isSectionDark ? 'text-[#A1A1AA]' : 'text-slate-500'}`}
                        >
                          INCOME &nbsp;&nbsp; MAY 18
                        </span>
                      </div>
                    </div>
                    <span className="text-[15px] sm:text-base font-medium text-[#32D74B]">
                      +35,000.00 ETB
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: Smart tips by AI */}
            {activeTab === 'ai' && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="h-full flex flex-col md:flex-row w-full max-w-4xl mx-auto"
              >
                {/* Left Column: User Persona */}
                <div
                  className={`md:w-[35%] text-left md:pr-10 md:border-r flex flex-col justify-center py-4 md:py-6 relative z-10 ${
                    isSectionDark ? 'border-white/[0.06]' : 'border-black/[0.06]'
                  }`}
                >
                  <div className="flex items-center md:items-start gap-4 md:gap-0 md:flex-col">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#10b981] flex items-center justify-center text-[28px] md:text-3xl shrink-0 shadow-inner">
                      🎙️
                    </div>
                    <div>
                      <h4
                        className={`text-[20px] md:text-[22px] font-medium mt-0 md:mt-4 tracking-tight ${isSectionDark ? 'text-white' : 'text-slate-900'}`}
                      >
                        {lang === 'en' ? 'Voice Engine' : 'የድምፅ ሞተር'}
                      </h4>
                      <p
                        className={`text-[13px] md:text-sm mt-0.5 md:mt-1 ${isSectionDark ? 'text-[#A1A1AA]' : 'text-slate-500'}`}
                      >
                        Amharic NLP &nbsp; Active
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div
                    className={`w-full h-[1px] my-5 md:my-6 hidden md:block ${isSectionDark ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`}
                  ></div>

                  {/* Persona Memory Skeleton Pills */}
                  <div className="space-y-3 w-full max-w-[200px] hidden md:block">
                    <div className="flex items-center gap-1.5 opacity-50">
                      <div
                        className={`h-8 w-1 rounded-full ${isSectionDark ? 'bg-emerald-400' : 'bg-emerald-600'} animate-pulse`}
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className={`h-4 w-1 rounded-full ${isSectionDark ? 'bg-emerald-400' : 'bg-emerald-600'} animate-pulse`}
                        style={{ animationDelay: '100ms' }}
                      />
                      <div
                        className={`h-6 w-1 rounded-full ${isSectionDark ? 'bg-emerald-400' : 'bg-emerald-600'} animate-pulse`}
                        style={{ animationDelay: '200ms' }}
                      />
                      <div
                        className={`h-3 w-1 rounded-full ${isSectionDark ? 'bg-emerald-400' : 'bg-emerald-600'} animate-pulse`}
                        style={{ animationDelay: '300ms' }}
                      />
                      <div
                        className={`h-7 w-1 rounded-full ${isSectionDark ? 'bg-emerald-400' : 'bg-emerald-600'} animate-pulse`}
                        style={{ animationDelay: '400ms' }}
                      />
                    </div>
                  </div>

                  <div
                    className={`hidden md:flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest mt-8 ${
                      isSectionDark ? 'text-[#71717A]' : 'text-slate-400'
                    }`}
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>LISTENING</span>
                  </div>
                </div>

                <div
                  className={`w-full h-[1px] my-4 md:hidden ${isSectionDark ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`}
                ></div>

                {/* Right Column: Interactive AI Assistant Chat */}
                <div className="md:w-[65%] flex flex-col justify-center h-full md:pl-10 py-2 md:py-6">
                  {/* User Question */}
                  <div className="flex justify-end mb-4 md:mb-6">
                    <div
                      className={`flex items-center gap-2 text-[14px] md:text-[15px] px-4 md:px-5 py-2.5 md:py-3 rounded-[20px] md:rounded-[24px] rounded-br-sm inline-block shadow-sm ${
                        isSectionDark ? 'bg-[#10b981] text-white' : 'bg-[#10b981] text-white'
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>{lang === 'en' ? '0:04 Voice Note' : '0:04 የድምፅ መልዕክት'}</span>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="text-left mb-4 md:mb-6">
                    <p
                      className={`text-[14px] md:text-[15px] font-medium mb-2 ${isSectionDark ? 'text-white' : 'text-slate-900'}`}
                    >
                      {lang === 'en' ? '✅ Logged successfully!' : '✅ በትክክል ተመዝግቧል!'}
                    </p>
                    <p
                      className={`text-[14px] md:text-[15px] mb-2 leading-relaxed ${isSectionDark ? 'text-[#D4D4D8]' : 'text-slate-700'}`}
                    >
                      {lang === 'en' ? '"Bought breakfast for 150 Birr"' : '"ገዛሁ 150 ብር ቁርስ"'}
                    </p>
                    <div
                      className={`mt-3 p-3 rounded-xl border ${isSectionDark ? 'bg-[#18181B] border-white/10' : 'bg-[#F4F4F5] border-black/10'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-[12px] md:text-sm font-semibold ${isSectionDark ? 'text-white' : 'text-slate-900'}`}
                        >
                          Food & Drinks
                        </span>
                        <span className="text-[12px] md:text-sm font-bold text-red-500">
                          -150.00 ETB
                        </span>
                      </div>
                    </div>

                    <div
                      className={`flex items-center gap-4 mt-3 md:mt-4 ${isSectionDark ? 'text-[#71717A]' : 'text-slate-400'}`}
                    >
                      <RotateCw
                        className={`w-4 h-4 cursor-pointer transition-colors ${isSectionDark ? 'hover:text-[#A1A1AA]' : 'hover:text-slate-600'}`}
                      />
                    </div>
                  </div>

                  {/* Bottom Input Box */}
                  <div
                    className={`border rounded-[24px] pl-4 pr-1.5 py-1.5 flex items-center justify-between shadow-sm mt-auto ${
                      isSectionDark
                        ? 'bg-[#18181B] border-white/[0.08]'
                        : 'bg-[#ffffff] border-black/[0.08]'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-3 text-[13px] md:text-sm ${isSectionDark ? 'text-[#A1A1AA]' : 'text-slate-500'}`}
                    >
                      <span>{lang === 'en' ? 'Message' : 'መልዕክት...'}</span>
                    </div>
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#10b981] flex items-center justify-center text-white cursor-pointer shadow-md">
                      <Volume2 className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};
