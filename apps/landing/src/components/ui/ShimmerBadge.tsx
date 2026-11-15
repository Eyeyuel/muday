import React from 'react';
import { motion } from 'framer-motion';

interface ShimmerBadgeProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  theme?: 'dark' | 'light';
  className?: string;
}

export const ShimmerBadge: React.FC<ShimmerBadgeProps> = ({
  children,
  icon,
  theme = 'dark',
  className = '',
}) => {
  const isDark = theme === 'dark';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
      className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-extrabold border overflow-hidden shadow-md cursor-pointer ${
        isDark
          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40 shadow-emerald-950/20'
          : 'bg-emerald-50 text-emerald-800 border-emerald-600/30 shadow-emerald-100'
      } ${className}`}
    >
      {/* Animated Shimmer Line */}
      <motion.div
        animate={{
          x: ['-100%', '200%'],
        }}
        transition={{
          repeat: Infinity,
          duration: 3,
          ease: 'linear',
        }}
        className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent skew-x-12"
      />

      {icon && <span className="relative z-10">{icon}</span>}
      <span className="relative z-10">{children}</span>
    </motion.div>
  );
};
