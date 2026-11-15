import React from 'react';

interface RetroGridProps {
  className?: string;
  theme?: 'dark' | 'light';
}

export const RetroGrid: React.FC<RetroGridProps> = ({ className = '', theme = 'dark' }) => {
  const isDark = theme === 'dark';

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden opacity-30 [perspective:200px] ${className}`}
    >
      {/* Grid Plane */}
      <div className="absolute inset-0 [transform:rotateX(35deg)]">
        <div
          className={`animate-grid [background-repeat:repeat] [background-size:60px_60px] [height:300vh] [inset:0%_-50%] [position:absolute] [width:200vw] ${
            isDark
              ? '[background-image:linear-gradient(to_right,rgba(16,185,129,0.2)_1px,transparent_0),linear-gradient(to_bottom,rgba(16,185,129,0.2)_1px,transparent_0)]'
              : '[background-image:linear-gradient(to_right,rgba(5,150,105,0.15)_1px,transparent_0),linear-gradient(to_bottom,rgba(5,150,105,0.15)_1px,transparent_0)]'
          }`}
        />
      </div>

      {/* Radial Gradient Vignette Overlay */}
      <div
        className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-t from-[#050811] via-transparent to-[#050811]'
            : 'bg-gradient-to-t from-slate-50 via-transparent to-slate-50'
        }`}
      />
    </div>
  );
};
