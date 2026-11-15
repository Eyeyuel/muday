/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: '#050811',
          card: 'rgba(15, 23, 42, 0.60)',
          popover: 'rgba(30, 41, 59, 0.70)',
          border: 'rgba(255, 255, 255, 0.08)',
          glow: 'rgba(16, 185, 129, 0.4)',
        },
        emerald: {
          500: '#10b981',
          600: '#059669',
          400: '#34d399',
        },
        teal: {
          600: '#0d9488',
        },
        cyan: {
          500: '#06b6d4',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'Noto Sans Ethiopic', 'sans-serif'],
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'shimmer-beam': 'shimmerBeam 2.5s infinite',
        'laser-scan': 'laserScan 2s ease-in-out infinite',
        'spin-slow': 'spin 12s linear infinite',
        meteor: 'meteor 5s linear infinite',
        'accordion-down': 'accordionDown 0.2s ease-out',
        'accordion-up': 'accordionUp 0.2s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        shimmerBeam: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        laserScan: {
          '0%, 100%': { top: '0%' },
          '50%': { top: '100%' },
        },
        meteor: {
          '0%': { transform: 'rotate(215deg) translateX(0)', opacity: '1' },
          '70%': { opacity: '1' },
          '100%': {
            transform: 'rotate(215deg) translateX(-500px)',
            opacity: '0',
          },
        },
        accordionDown: {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        accordionUp: {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      backdropBlur: {
        xs: '4px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
};
