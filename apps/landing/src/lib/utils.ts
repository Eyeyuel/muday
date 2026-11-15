import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility helper to conditionally join classNames and merge Tailwind CSS classes seamlessly.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
