import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Sun, Moon, Menu, X } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

interface NavbarProps {
  lang: 'en' | 'am';
  onToggleLang: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ lang, onToggleLang, theme, onToggleTheme }) => {
  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOverPocketSection, setIsOverPocketSection] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const pocketSection = document.getElementById('dark-pocket-section');
      if (pocketSection) {
        const rect = pocketSection.getBoundingClientRect();
        // The navbar is approx 72px tall. We check if the section is currently under the navbar.
        if (rect.top <= 72 && rect.bottom >= 72) {
          setIsOverPocketSection(true);
        } else {
          setIsOverPocketSection(false);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check on mount
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'features', href: '#features', label: lang === 'en' ? 'Features' : 'ባህሪያት' },
    { id: 'how-it-works', href: '#how-it-works', label: lang === 'en' ? 'How it Works' : 'አሰራር' },
    { id: 'mini-app', href: '#mini-app', label: lang === 'en' ? 'Mini App' : 'ሚኒ አፕ' },
    { id: 'faq', href: '#faq', label: lang === 'en' ? 'FAQ' : 'ጥያቄዎች' },
  ];

  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    if (location.pathname !== '/') {
      void navigate('/' + targetId);
      // Wait for React to render the home page, then scroll
      setTimeout(() => {
        if (targetId === '#') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          const element = document.querySelector(targetId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, 100);
    } else {
      if (targetId === '#') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const element = document.querySelector(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
    setIsMobileMenuOpen(false);
  };

  const isThemeDark = theme === 'dark';
  // If we are over the pocket section, the theme is completely inverted based on user requirements.
  const effectiveIsDark = isOverPocketSection ? !isThemeDark : isThemeDark;

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 inset-x-0 z-50 w-full transition-all duration-300 ease-out ${
        isOverPocketSection
          ? effectiveIsDark
            ? 'bg-[#000000] text-white'
            : 'bg-[#ffffff] text-slate-900'
          : effectiveIsDark
            ? 'bg-[#050811] text-white'
            : 'bg-[#f4f4f6] text-slate-900'
      }`}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <Link
          to="/"
          onClick={(event) => handleNavClick(event, '#')}
          className="flex items-center gap-3 shrink-0"
        >
          <img
            src="/muday-logo-transparent.png"
            alt="Muday Logo"
            className="h-8 w-auto object-contain"
          />
          <span className="font-extrabold text-lg tracking-tight flex items-center gap-1.5">
            Muday <span className="text-emerald-500 text-sm font-semibold">| ሙዳይ</span>
          </span>
        </Link>

        {/* Center Nav Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              onMouseEnter={() => setActiveHover(link.id)}
              onMouseLeave={() => setActiveHover(null)}
              className={`relative px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                effectiveIsDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              {activeHover === link.id && (
                <motion.div
                  layoutId="navbar-pill-hover"
                  className={`absolute inset-0 rounded-full ${
                    effectiveIsDark ? 'bg-white/10' : 'bg-slate-100'
                  }`}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{link.label}</span>
            </a>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Theme Switcher Toggle */}
          <button
            onClick={onToggleTheme}
            className={`flex items-center justify-center h-10 w-10 rounded-full border transition-all cursor-pointer ${
              effectiveIsDark
                ? 'bg-slate-900 border-white/10 text-amber-400 hover:border-amber-400/50'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
            title="Toggle Theme"
          >
            {isThemeDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Language Switcher Toggle */}
          <button
            onClick={onToggleLang}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold border transition-all cursor-pointer ${
              effectiveIsDark
                ? 'bg-slate-900/80 border-white/10 text-slate-200 hover:border-emerald-500/50 hover:text-emerald-400'
                : 'bg-slate-100 border-slate-200 text-slate-800 hover:border-emerald-600/50 hover:text-emerald-600'
            }`}
          >
            <Globe className="h-4 w-4 text-emerald-500" />
            <span>{lang === 'en' ? 'EN' : 'አማ'}</span>
          </button>

          {/* Primary Purple Pill CTA */}
          <a
            href="https://t.me/mudayaibot"
            target="_blank"
            rel="noopener noreferrer"
            className={`hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold transition-colors bg-transparent border-0 shadow-none p-0 group ${
              effectiveIsDark ? 'text-white hover:text-gray-300' : 'text-black hover:text-gray-700'
            }`}
          >
            <span>{lang === 'en' ? 'Start tracking for free' : 'አሁኑኑ በነፃ ይጀምሩ'}</span>
            <span className="text-base font-normal">→</span>
          </a>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`md:hidden flex items-center justify-center h-8 w-8 rounded-full border transition-colors ${
              effectiveIsDark
                ? 'border-white/10 bg-slate-900 text-slate-300'
                : 'border-slate-200 bg-slate-100 text-slate-700'
            }`}
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`pointer-events-auto mt-2 mx-auto max-w-5xl rounded-2xl p-4 border shadow-2xl md:hidden ${
              effectiveIsDark
                ? 'bg-slate-950/95 border-white/10 text-white'
                : 'bg-white/95 border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  onClick={(e) => {
                    handleNavClick(e, link.href);
                    setIsMobileMenuOpen(false);
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="https://t.me/mudayaibot"
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold transition-colors bg-transparent border-0 shadow-none py-2.5 group ${
                  effectiveIsDark
                    ? 'text-white hover:text-gray-300'
                    : 'text-black hover:text-gray-700'
                }`}
              >
                <span>{lang === 'en' ? 'Start tracking for free' : 'አሁኑኑ በነፃ ይጀምሩ'}</span>
                <span className="text-base font-normal">→</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};
