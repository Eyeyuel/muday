import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { FAQFooterSection } from './components/FAQFooterSection';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfUse } from './pages/TermsOfUse';
import { Home } from './pages/Home';

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

export const App: React.FC = () => {
  const [lang, setLang] = useState<'en' | 'am'>(() => {
    return (localStorage.getItem('muday_lang') as 'en' | 'am') || 'en';
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('muday_theme') as 'dark' | 'light';
    if (stored) return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    localStorage.setItem('muday_lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('muday_theme', theme);
  }, [theme]);

  // Sync theme class to html root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleLang = () => {
    setLang((prev) => (prev === 'en' ? 'am' : 'en'));
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <BrowserRouter>
      <ScrollToTop />
      <div
        className={`min-h-screen font-sans transition-colors duration-300 ${
          theme === 'dark' ? 'bg-[#050811] text-slate-100' : 'bg-[#f8f9fc] text-slate-900'
        }`}
      >
        {/* Top Floating Pill Header (Phase 2) */}
        <Navbar
          lang={lang}
          onToggleLang={handleToggleLang}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        {/* Main Page Sections */}
        <main>
          <Routes>
            <Route path="/" element={<Home lang={lang} theme={theme} />} />
            <Route path="/privacy" element={<PrivacyPolicy lang={lang} theme={theme} />} />
            <Route path="/terms" element={<TermsOfUse lang={lang} theme={theme} />} />
          </Routes>

          {/* Pre-Footer Banner & Multi-Column Footer (Phase 8) */}
          <FAQFooterSection lang={lang} theme={theme} />
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
