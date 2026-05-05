import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Format handicap according to golf conventions
// Negative stored values (elite players) display as + (e.g., -3 → +3.0)
// Positive stored values display as-is (e.g., 12.4 → 12.4)
export function formatHandicap(handicap) {
  if (handicap == null) return null;
  const num = parseFloat(handicap);
  if (isNaN(num)) return null;
  if (num < 0) {
    // Plus handicap (elite player)
    return `+${Math.abs(num).toFixed(1)}`;
  }
  // Regular handicap
  return num.toFixed(1);
}
