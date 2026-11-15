import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Bike, Home, Sparkles, Send } from 'lucide-react';

interface SocialProofSectionProps {
  lang: 'en' | 'am';
  theme: 'dark' | 'light';
}

export const SocialProofSection: React.FC<SocialProofSectionProps> = ({ lang, theme }) => {
  const isDark = theme === 'dark';

  return (
    <section
      id="features"
      className={`relative pt-24 pb-28 overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-[#050811] text-white' : 'bg-[#f4f4f6] text-slate-900'
      }`}
    >
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 w-full z-10 text-center">
        {/* Statement Typography Callout 1 */}
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className={`font-general-sans text-3xl sm:text-4xl lg:text-[48px] font-medium tracking-[-1.44px] leading-snug lg:leading-[52.8px] max-w-4xl mx-auto antialiased break-words ${
            isDark ? 'text-white' : 'text-[#000000]'
          }`}
          style={{
            fontFeatureSettings: '"blwf", "cv03", "cv04", "cv09", "cv11"',
          }}
        >
          {lang === 'en' ? (
            <>
              Muday helps you make sense of your money right inside Telegram. Just send a voice
              note, text, or receipt photo, and Muday will automatically categorize and track your
              expenses.
            </>
          ) : (
            <>
              ሙዳይ የገንዘብ እንቅስቃሴዎን በቴሌግራም ውስጥ በቀላሉ እንዲቆጣጠሩ ይረዳዎታል። የድምፅ መልዕክት፣ ጽሁፍ ወይም የደረሰኝ ፎቶ በመላክ
              ብቻ ወጪዎችዎን በራሱ ይመዘግባል።
            </>
          )}
        </motion.h2>

        {/* Statement Typography Callout 2 */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className={`mt-8 text-lg sm:text-2xl font-normal max-w-3xl mx-auto leading-relaxed ${
            isDark ? 'text-slate-400' : 'text-[#64748b]'
          }`}
        >
          {lang === 'en' ? (
            <>
              It offers you smart, simple, and actionable AI tips to budget better and grow your
              savings, without ever leaving your favorite chat app.
            </>
          ) : (
            <>ያለ ምንም ተጨማሪ አፕሊኬሽን የተሻለ በጀት እንዲያወጡ እና ቁጠባዎን እንዲያሳድጉ ብልህ የ AI ምክሮችን ይሰጥዎታል።</>
          )}
        </motion.p>

        {/* Showcase Composition: Center Phone Mockup (z-10) + Overlapping Floating Cards (z-30) */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-12 md:mt-20 w-full flex justify-center overflow-visible"
        >
          {/* Scalable Fixed Canvas for Complex Overlap */}
          <div className="relative w-[900px] h-[550px] shrink-0 transform scale-[0.35] min-[380px]:scale-[0.4] min-[450px]:scale-[0.5] sm:scale-[0.7] md:scale-[0.85] lg:scale-100 origin-top mb-[-357px] min-[380px]:mb-[-330px] min-[450px]:mb-[-275px] sm:mb-[-165px] md:mb-[-82px] lg:mb-0">
            {/* Lowered Left My Goals Container: 70% TRANSPARENT Background, Backdrop Blur, SOLID Inner Cards */}
            <motion.div
              initial={{ opacity: 0, x: -80 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
              className={`absolute left-0 top-10 z-30 p-6 rounded-[32px] border shadow-none backdrop-blur-2xl w-[340px] text-left h-[480px] flex flex-col justify-between ${
                isDark
                  ? 'bg-slate-900/30 border-white/10 text-white'
                  : 'bg-white/30 border-white/60 text-slate-900'
              }`}
            >
              <div>
                <span
                  className={`text-sm font-semibold block mb-4 px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                >
                  My goals
                </span>

                {/* Goal Item 1: New Bike (SOLID Color) */}
                <div
                  className={`rounded-2xl p-4 mb-3.5 flex items-center justify-between transition-colors ${
                    isDark
                      ? 'bg-[#0f172a] border border-white/10 text-white shadow-none'
                      : 'bg-white border border-slate-200/80 text-slate-900 shadow-sm'
                  }`}
                >
                  <div>
                    <span
                      className={`text-[11px] font-semibold uppercase block ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
                    >
                      New Bike
                    </span>
                    <span
                      className={`text-xl font-bold font-sans block mt-0.5 ${isDark ? 'text-white' : 'text-slate-950'}`}
                    >
                      14,230 ETB
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">by Nov, 2025</span>
                  </div>
                  <div className="relative w-11 h-11 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className={isDark ? 'text-slate-700' : 'text-slate-100'}
                        strokeWidth="3"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-emerald-500"
                        strokeDasharray="75, 100"
                        strokeWidth="3"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div
                      className={`absolute w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}
                    >
                      <Bike className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Goal Item 2: House (SOLID Color) */}
                <div
                  className={`rounded-2xl p-4 mb-4 flex items-center justify-between transition-colors ${
                    isDark
                      ? 'bg-[#0f172a] border border-white/10 text-white shadow-none'
                      : 'bg-white border border-slate-200/80 text-slate-900 shadow-sm'
                  }`}
                >
                  <div>
                    <span
                      className={`text-[11px] font-semibold uppercase block ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
                    >
                      House
                    </span>
                    <span
                      className={`text-xl font-bold font-sans block mt-0.5 ${isDark ? 'text-white' : 'text-slate-950'}`}
                    >
                      4,500,000 ETB
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">by June, 2026</span>
                  </div>
                  <div className="relative w-11 h-11 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className={isDark ? 'text-slate-700' : 'text-slate-100'}
                        strokeWidth="3"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-amber-500"
                        strokeDasharray="60, 100"
                        strokeWidth="3"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div
                      className={`absolute w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}
                    >
                      <Home className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Goal Item 3: Add a new goal button (SOLID Color) */}
              <div
                className={`border border-dashed rounded-2xl p-4 text-center text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                  isDark
                    ? 'bg-[#0f172a] border-white/20 text-slate-300 hover:text-white'
                    : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900 shadow-sm'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <span>Add a new goal</span>
              </div>
            </motion.div>

            {/* Center Smartphone Mockup Frame (Identical Bezel & Notch as Hero Section) */}
            <div className="absolute left-[280px] top-0 z-10 w-[340px] flex justify-center">
              {/* Phone Base Image */}
              <img
                src="/assets/phone.avif"
                alt="Muday Statement Phone Mockup"
                className="w-full h-auto object-contain relative z-10 drop-shadow-2xl"
              />
              {/* Inner Screen Canvas Overlay: Identical Inset & Notch as Hero Section */}
              <div
                className={`absolute inset-x-[6.5%] top-[2.8%] bottom-[4.5%] z-20 rounded-[32px] bg-dot-pattern flex flex-col items-center justify-between p-3 text-center overflow-hidden transition-colors ${
                  isDark ? 'bg-slate-900' : 'bg-[#f8f9fc]'
                }`}
              >
                {/* Top Dynamic Island Notch (Matches Hero Section) */}
                <div className="mx-auto w-[30%] h-3.5 bg-black rounded-full shrink-0 mb-1" />

                <div className="flex-1 flex flex-col items-center justify-center">
                  <span
                    className={`text-3xl sm:text-4xl font-medium tracking-tight font-sans transition-colors ${
                      isDark ? 'text-emerald-400' : 'text-emerald-600'
                    }`}
                  >
                    Muday
                  </span>
                </div>
              </div>
            </div>

            {/* Top Right Floating Card: Expenses Bar Chart (~20% Overlaps ON TOP of Phone Right Edge at z-30) */}
            <motion.div
              initial={{ opacity: 0, x: 80 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.4, ease: 'easeOut' }}
              className={`absolute right-0 top-16 z-30 p-7 rounded-[28px] border shadow-2xl backdrop-blur-xl w-[340px] text-left ${
                isDark
                  ? 'bg-slate-900/60 border-white/10 text-white shadow-black/50'
                  : 'bg-white/90 border-white/80 text-slate-900 shadow-slate-300/50'
              }`}
            >
              <div className="flex items-stretch justify-between">
                <div className="flex flex-col justify-between h-32">
                  <span
                    className={`text-[16px] font-normal block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                  >
                    Expenses
                  </span>
                  <div className="mt-auto">
                    <span
                      className={`text-3xl sm:text-4xl font-bold font-sans block leading-none tracking-tight ${isDark ? 'text-white' : 'text-black'}`}
                    >
                      14,230 ETB
                    </span>
                    <span
                      className={`text-[11px] font-bold uppercase tracking-widest block mt-3 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
                    >
                      WEEKLY TRANSACTIONS
                    </span>
                  </div>
                </div>

                {/* Vertical Rounded Bar Chart */}
                <div className="flex items-end gap-2.5 sm:gap-3 h-32 shrink-0">
                  <div
                    className={`w-[14px] sm:w-[16px] rounded-full h-[35%] ${isDark ? 'bg-slate-700' : 'bg-[#e6e6e6]'}`}
                  />
                  <div
                    className={`w-[14px] sm:w-[16px] rounded-full h-[65%] ${isDark ? 'bg-slate-700' : 'bg-[#e6e6e6]'}`}
                  />
                  <div className="w-[14px] sm:w-[16px] bg-[#be185d] rounded-full h-[50%]" />
                  <div
                    className={`w-[14px] sm:w-[16px] rounded-full h-[100%] ${isDark ? 'bg-slate-700' : 'bg-[#e6e6e6]'}`}
                  />
                  <div className="w-[14px] sm:w-[16px] bg-[#059669] rounded-full h-[35%]" />
                  <div
                    className={`w-[14px] sm:w-[16px] rounded-full h-[80%] ${isDark ? 'bg-slate-700' : 'bg-[#e6e6e6]'}`}
                  />
                </div>
              </div>
            </motion.div>

            {/* Bottom Right Floating Card: AI Ask Anything Pill (~20% Overlaps ON TOP of Phone Right Edge at z-30) */}
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.6, ease: 'easeOut' }}
              className={`absolute right-8 sm:right-12 md:right-24 lg:right-32 bottom-10 z-30 p-5 rounded-[24px] border shadow-2xl backdrop-blur-xl w-60 sm:w-68 text-center ${
                isDark
                  ? 'bg-slate-900/60 border-white/10 text-white shadow-black/50'
                  : 'bg-white/90 border-white/80 text-slate-900 shadow-slate-300/50'
              }`}
            >
              {/* Center Glowing Gradient Ring */}
              <div className="mx-auto w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-emerald-400 via-teal-400 to-emerald-600 mb-4 flex items-center justify-center shadow-xs">
                <div
                  className={`w-full h-full rounded-full flex items-center justify-center text-emerald-600 ${isDark ? 'bg-slate-900' : 'bg-white'}`}
                >
                  <Sparkles className="w-5 h-5 text-emerald-500" />
                </div>
              </div>

              {/* Input Pill Box */}
              <div
                className={`border rounded-full px-3.5 py-2 flex items-center justify-between ${isDark ? 'bg-slate-800 border-white/10' : 'bg-slate-50 border-slate-200'}`}
              >
                <span className="text-xs text-slate-500 font-normal flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Ask anything
                </span>
                <div className="w-6.5 h-6.5 rounded-full bg-[#10b981] text-white flex items-center justify-center shadow-xs cursor-pointer">
                  <Send className="w-3 h-3" />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
