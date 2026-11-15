import React, { useEffect, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

export const CustomCursor: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isPointer, setIsPointer] = useState(false);

  // Smooth springs for cursor position
  const cursorX = useSpring(-100, { stiffness: 400, damping: 28 });
  const cursorY = useSpring(-100, { stiffness: 400, damping: 28 });

  // Trailing ambient glow ball springs (softer physics)
  const glowX = useSpring(-100, { stiffness: 120, damping: 20 });
  const glowY = useSpring(-100, { stiffness: 120, damping: 20 });

  useEffect(() => {
    // Disable custom cursor on touch devices
    if (window.matchMedia('(pointer: coarse)').matches) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      setIsVisible(true);
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      glowX.set(e.clientX);
      glowY.set(e.clientY);

      // Check if mouse is hovering over interactive elements
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'BUTTON' ||
          target.tagName === 'A' ||
          target.tagName === 'INPUT' ||
          target.closest('button') ||
          target.closest('a') ||
          target.getAttribute('role') === 'button' ||
          target.classList.contains('interactive'))
      ) {
        setIsPointer(true);
      } else {
        setIsPointer(false);
      }
    };

    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [cursorX, cursorY, glowX, glowY]);

  if (!isVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {/* Ambient Trailing Glow Ball */}
      <motion.div
        className="absolute rounded-full bg-emerald-500/20 blur-xl"
        style={{
          x: glowX,
          y: glowY,
          width: isPointer ? 140 : 90,
          height: isPointer ? 140 : 90,
          translateX: '-50%',
          translateY: '-50%',
        }}
        transition={{ duration: 0.15 }}
      />

      {/* Center Precision Cursor Ring */}
      <motion.div
        className="absolute rounded-full border border-emerald-400/60 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
        style={{
          x: cursorX,
          y: cursorY,
          width: isPointer ? 36 : 20,
          height: isPointer ? 36 : 20,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          scale: isPointer ? 1.3 : 1,
          backgroundColor: isPointer ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.05)',
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      />
    </div>
  );
};
