import React from 'react';
import { motion } from 'framer-motion';

interface AudioWaveformProps {
  isPlaying?: boolean;
  barCount?: number;
  className?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isPlaying = true,
  barCount = 16,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: barCount }).map((_, index) => {
        // Vary heights for a realistic soundwave layout
        const baseHeight = 8 + (index % 5) * 4;
        const targetHeight = 24 + (index % 3) * 8;

        return (
          <motion.span
            key={index}
            className="w-1 rounded-full bg-gradient-to-t from-emerald-500 to-teal-300"
            style={{ height: baseHeight }}
            animate={
              isPlaying
                ? {
                    height: [baseHeight, targetHeight, baseHeight],
                  }
                : { height: baseHeight }
            }
            transition={{
              duration: 0.8 + (index % 4) * 0.2,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
              delay: index * 0.05,
            }}
          />
        );
      })}
    </div>
  );
};
