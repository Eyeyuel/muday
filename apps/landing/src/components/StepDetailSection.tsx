import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Zap,
  BarChart3,
  ArrowRight,
  Coffee,
  Car,
  Briefcase,
  Film,
  Utensils,
  ShoppingCart,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StepDetailSectionProps {
  lang: 'en' | 'am';
  theme: 'dark' | 'light';
}

export const StepDetailSection: React.FC<StepDetailSectionProps> = ({ lang, theme }) => {
  const isDark = theme === 'dark';
  const [activeStep, setActiveStep] = useState(0);

  const step0Ref = useRef<HTMLDivElement>(null);
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-30% 0px -30% 0px',
      threshold: 0.2,
    };

    const handleIntersect: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const stepIndex = Number(entry.target.getAttribute('data-step'));
          if (!isNaN(stepIndex)) {
            setActiveStep(stepIndex);
          }
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);

    if (step0Ref.current) observer.observe(step0Ref.current);
    if (step1Ref.current) observer.observe(step1Ref.current);
    if (step2Ref.current) observer.observe(step2Ref.current);

    return () => observer.disconnect();
  }, []);

  const steps = [
    {
      num: '01',
      icon: <Send className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />,
      title: lang === 'en' ? 'Connect in Telegram' : 'በቴሌግራም ይጀምሩ',
      desc:
        lang === 'en'
          ? 'Link your Telegram account in seconds. Send natural voice notes in Amharic or English, paste bank SMS notifications, or snap photo receipts.'
          : 'በቴሌግራም አካውንትዎን በሰከንዶች ያገናኙ። በአማርኛ ወይም በእንግሊዝኛ የድምፅ መልዕክት፣ የባንክ መልዕክት ወይም የደረሰኝ ፎቶ ይላኩ።',
      badge: lang === 'en' ? 'Step 01' : 'ደረጃ 01',
      phoneScreen: (
        <div className="p-4 pt-8 text-left font-sans">
          <span
            className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
          >
            TELEGRAM VOICE BOT
          </span>
          <div className="bg-[#10b981] text-white p-3 rounded-2xl mb-3 text-xs shadow-md">
            🎙️ "ገዛሁ 150 ብር ቡና እና ቁርስ"
          </div>
          <div
            className={`p-3 rounded-2xl border text-xs shadow-xs ${isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}
          >
            <span className="text-emerald-500 font-bold block mb-1">✓ Transaction Logged</span>
            <span
              className={`font-mono font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}
            >
              150.00 ETB
            </span>
            <span className="text-[10px] text-slate-400">Category: Food & Breakfast</span>
          </div>
        </div>
      ),
    },
    {
      num: '02',
      icon: <Zap className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />,
      title: lang === 'en' ? 'Auto-categorise' : 'በራሱ ምደባ',
      desc:
        lang === 'en'
          ? 'Muday AI automatically categorises every transaction into Food, Transport, CBE Bank, Telebirr, and Utility Bills so you know where your money goes.'
          : 'ሙዳይ AI እያንዳንዱን ወጪ በምግብ፣ በትራንስፖርት፣ በባንክ እና በቴሌብር በራሱ መድቦ ያደራጃል።',
      badge: lang === 'en' ? 'Step 02' : 'ደረጃ 02',
      phoneScreen: (
        <div
          className={`px-5 pt-8 pb-4 text-left font-sans h-full flex flex-col relative transition-colors ${isDark ? 'bg-slate-900 text-white' : 'bg-[#F9F9FB] text-slate-900'}`}
        >
          <div className="flex justify-between items-end mb-6">
            <div>
              <span className="text-[10px] font-medium text-slate-400 block mb-0.5">
                Transactions
              </span>
              <div className="flex items-center gap-1.5 cursor-pointer">
                <span
                  className={`text-3xl font-medium tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
                >
                  All
                </span>
                <div className="w-2 h-2 bg-emerald-600 rounded-full mt-1" />
              </div>
            </div>
            <div className="flex gap-3 text-[8px] font-bold tracking-wider text-slate-400 mb-1.5">
              <span>THIS WEEK</span>
              <span>LAST MONTH</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Transaction 1 */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white shadow-sm border border-slate-100 text-slate-700'}`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span
                    className={`text-[13px] font-medium block ${isDark ? 'text-white' : 'text-slate-900'}`}
                  >
                    Tomoca Coffee
                  </span>
                  <span className="text-[8px] text-slate-400 uppercase tracking-wider block mt-0.5">
                    Food & Drinks
                  </span>
                </div>
              </div>
              <span className="text-[13px] font-medium text-red-500">-150.00 ETB</span>
            </div>
            {/* Transaction 2 */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white shadow-sm border border-slate-100 text-slate-700'}`}
                >
                  <Car className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span
                    className={`text-[13px] font-medium block ${isDark ? 'text-white' : 'text-slate-900'}`}
                  >
                    Ride Transport
                  </span>
                  <span className="text-[8px] text-slate-400 uppercase tracking-wider block mt-0.5">
                    Transport
                  </span>
                </div>
              </div>
              <span className="text-[13px] font-medium text-red-500">-350.00 ETB</span>
            </div>
            {/* Transaction 3 */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white shadow-sm border border-slate-100 text-slate-700'}`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span
                    className={`text-[13px] font-medium block ${isDark ? 'text-white' : 'text-slate-900'}`}
                  >
                    Upwork Salary
                  </span>
                  <span className="text-[8px] text-slate-400 uppercase tracking-wider block mt-0.5">
                    Income
                  </span>
                </div>
              </div>
              <span className="text-[13px] font-medium text-emerald-500">+35,000 ETB</span>
            </div>

            <span className="text-[9px] font-medium text-slate-400 block pt-1 pb-1">Yesterday</span>

            {/* Transaction 4 */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white shadow-sm border border-slate-100 text-slate-700'}`}
                >
                  <Film className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span
                    className={`text-[13px] font-medium block ${isDark ? 'text-white' : 'text-slate-900'}`}
                  >
                    Century Cinema
                  </span>
                  <span className="text-[8px] text-slate-400 uppercase tracking-wider block mt-0.5">
                    Entertainment
                  </span>
                </div>
              </div>
              <span className="text-[13px] font-medium text-red-500">-400.00 ETB</span>
            </div>
            {/* Transaction 5 */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white shadow-sm border border-slate-100 text-slate-700'}`}
                >
                  <Utensils className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span
                    className={`text-[13px] font-medium block ${isDark ? 'text-white' : 'text-slate-900'}`}
                  >
                    Kuriftu Resort
                  </span>
                  <span className="text-[8px] text-slate-400 uppercase tracking-wider block mt-0.5">
                    Food & Drinks
                  </span>
                </div>
              </div>
              <span className="text-[13px] font-medium text-red-500">-2,500.00 ETB</span>
            </div>
          </div>

          {/* Floating Dropdown */}
          <div
            className={`absolute top-[4rem] left-8 rounded-xl shadow-2xl border p-1.5 w-44 z-40 backdrop-blur-xl ${isDark ? 'bg-slate-800/90 border-slate-700/50 shadow-black/40' : 'bg-white/95 border-slate-200/80 shadow-slate-200/50'}`}
          >
            <div className="flex flex-col text-[11px] font-medium">
              <div
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer mb-0.5 ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}
              >
                <div className="flex items-center gap-2.5">
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Food & Drinks</span>
                </div>
                <Check className="w-3.5 h-3.5" />
              </div>
              <div
                className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${isDark ? 'text-slate-300 hover:bg-slate-700/50' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Car className="w-3.5 h-3.5 opacity-70" />
                <span>Transport</span>
              </div>
              <div
                className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${isDark ? 'text-slate-300 hover:bg-slate-700/50' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <ShoppingCart className="w-3.5 h-3.5 opacity-70" />
                <span>Shopping</span>
              </div>
              <div
                className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${isDark ? 'text-slate-300 hover:bg-slate-700/50' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Zap className="w-3.5 h-3.5 opacity-70" />
                <span>Bills & Utilities</span>
              </div>
              <div
                className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${isDark ? 'text-slate-300 hover:bg-slate-700/50' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Film className="w-3.5 h-3.5 opacity-70" />
                <span>Entertainment</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      num: '03',
      icon: <BarChart3 className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />,
      title: lang === 'en' ? 'Get Smart Reports' : 'ዘመናዊ ሪፖርቶች ያግኙ',
      desc:
        lang === 'en'
          ? 'Open interactive Mini App visual charts, monthly spending breakdowns, and AI-powered budget tips directly inside Telegram.'
          : 'በቴሌግራም ሚኒ አፕ ውስጥ በይነተገናኝ የቪዥዋል ገበታዎችን፣ የወር ወጪ ስታቲስቲክስን እና የአርቴፊሻል ኢንተለጀንስ ምክሮችን ይመልከቱ።',
      badge: lang === 'en' ? 'Step 03' : 'ደረጃ 03',
      phoneScreen: (
        <div className="p-4 pt-8 text-left font-sans">
          <span
            className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
          >
            MINI APP INSIGHTS
          </span>
          <div
            className={`p-3 rounded-2xl border mb-3 shadow-xs ${isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}
          >
            <span className="text-[10px] text-slate-400 block">Monthly Savings Rate</span>
            <span className="text-xl font-mono font-extrabold text-emerald-500 block">+24.5%</span>
          </div>
          <div className="bg-[#10b981] text-white p-3 rounded-2xl text-xs flex items-center justify-between">
            <span>✨ AI Tip: Reduce food delivery by 15%</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      ),
    },
  ];

  return (
    <section
      id="how-it-works"
      className={`relative pt-24 pb-28 transition-colors duration-300 ${
        isDark ? 'bg-[#050811] text-white' : 'bg-[#f4f4f6] text-slate-900'
      }`}
    >
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 w-full">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span
            className={`font-mono text-xs font-bold tracking-widest uppercase block mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
          >
            {lang === 'en' ? 'HOW IT WORKS' : 'ቀላል 3 ደረጃዎች'}
          </span>
          <h2
            className={`font-general-sans text-3xl sm:text-4xl lg:text-[48px] font-medium tracking-[-1.44px] leading-snug lg:leading-[52.8px] antialiased break-words ${
              isDark ? 'text-white' : 'text-[#000000]'
            }`}
            style={{ fontFeatureSettings: '"blwf", "cv03", "cv04", "cv09", "cv11"' }}
          >
            {lang === 'en' ? '3 Simple steps to start' : 'በ 3 ቀላል ደረጃዎች ይጀምሩ'}
          </h2>
        </div>

        {/* 2-Column Layout */}
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Equal Height Step Blocks */}
          <div className="lg:col-span-5 space-y-48 py-8">
            {steps.map((step, idx) => {
              const stepRefs = [step0Ref, step1Ref, step2Ref];

              return (
                <div
                  key={idx}
                  ref={stepRefs[idx]}
                  data-step={idx}
                  className="min-h-[55vh] flex flex-col justify-center text-left opacity-100"
                >
                  <div
                    className={`inline-flex items-center gap-2 font-mono text-xs font-bold px-3.5 py-1 rounded-full mb-4 w-fit border ${
                      isDark
                        ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
                        : 'text-emerald-600 bg-emerald-100 border-emerald-200'
                    }`}
                  >
                    {step.icon}
                    <span>{step.badge}</span>
                  </div>

                  <h3
                    className={`text-3xl sm:text-4xl font-semibold tracking-tight mb-4 ${
                      isDark ? 'text-white' : 'text-[#09090b]'
                    }`}
                  >
                    {step.title}
                  </h3>

                  <p
                    className={`text-base sm:text-lg font-normal leading-relaxed ${
                      isDark ? 'text-slate-400' : 'text-[#64748b]'
                    }`}
                  >
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Right Column: Sticky Phone Container Frame */}
          <div className="lg:col-span-7 sticky top-32 hidden lg:block">
            <div className="w-[90%] max-w-[420px] mx-auto">
              <div
                className={`relative rounded-[40px] pt-12 sm:pt-16 px-10 sm:px-14 pb-0 min-h-[460px] flex items-end justify-center overflow-hidden border shadow-2xl bg-dot-pattern transition-all ${
                  isDark
                    ? 'bg-slate-950/90 border-white/10 shadow-black/50'
                    : 'bg-[#ededf0] border-slate-200/90 shadow-slate-200/60'
                }`}
              >
                {/* Smartphone Mockup Frame */}
                <div className="relative z-10 w-full flex justify-center">
                  <img
                    src="/assets/phone.avif"
                    alt="Muday Sticky Phone Mockup"
                    className="w-full h-auto object-contain drop-shadow-2xl relative z-10"
                  />

                  {/* Dynamic Screen Content Overlay matching Active Step */}
                  <div
                    className={`absolute inset-x-[6.5%] top-[2.8%] bottom-[4.5%] z-20 rounded-[32px] overflow-hidden shadow-inner flex flex-col justify-between transition-colors ${
                      isDark ? 'bg-slate-900 text-white' : 'bg-[#f8f9fc] text-slate-900'
                    }`}
                  >
                    {/* Top Dynamic Island Notch */}
                    <div className="mx-auto w-[30%] h-3.5 bg-black rounded-full shrink-0 mb-1 z-30 relative" />

                    <div className="flex-1 relative overflow-hidden">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeStep}
                          initial={{ opacity: 0, y: 10, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.98 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className="absolute inset-0 h-full w-full flex flex-col justify-center"
                        >
                          {steps[activeStep].phoneScreen}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
