import React, { useEffect, useState } from 'react';

interface MeteorsProps {
  number?: number;
  theme?: 'dark' | 'light';
}

export const Meteors: React.FC<MeteorsProps> = ({ number = 20, theme = 'dark' }) => {
  const [meteorStyles, setMeteorStyles] = useState<Array<React.CSSProperties>>([]);

  useEffect(() => {
    const styles = Array.from({ length: number }).map(() => ({
      top: `${Math.floor(Math.random() * 80)}%`,
      left: `${Math.floor(Math.random() * 90)}%`,
      animationDelay: `${(Math.random() * 0.8 + 0.2).toFixed(2)}s`,
      animationDuration: `${Math.floor(Math.random() * 8 + 4)}s`,
    }));
    setMeteorStyles(styles);
  }, [number]);

  const isDark = theme === 'dark';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      {meteorStyles.map((style, idx) => (
        <span
          key={idx}
          className={`absolute h-0.5 w-0.5 rotate-[215deg] animate-meteor rounded-full ${
            isDark
              ? 'bg-[#10b981] shadow-[0_0_0_1px_#10b98110]'
              : 'bg-[#059669] shadow-[0_0_0_1px_#05966920]'
          }`}
          style={style}
        >
          {/* Glowing Tail */}
          <div
            className={`pointer-events-none absolute top-1/2 -z-10 h-[1px] w-[60px] -translate-y-1/2 bg-gradient-to-r ${
              isDark ? 'from-[#10b981] to-transparent' : 'from-[#059669] to-transparent'
            }`}
          />
        </span>
      ))}
    </div>
  );
};
