import { icon } from "../functions/utils/icon.js";

const SLOTS = [
  "progress_start_full",
  "progress_mid_full",
  "progress_end_full",
  "progress_start_empty",
  "progress_mid_empty",
  "progress_end_empty",
] as const;

/** Returns null until all six Application Emojis are available. */
export function progressBarEmojis(
  percent: number,
  _duration = 100,
  size = 10,
): string | null {
  const [startFull, midFull, endFull, startEmpty, midEmpty, endEmpty] =
    SLOTS.map((name) => {
      const value = icon[name].toString();
      return /^<a?:[a-zA-Z0-9_]+:\d+>$/.test(value) ? value : null;
    });
  if (
    !startFull ||
    !midFull ||
    !endFull ||
    !startEmpty ||
    !midEmpty ||
    !endEmpty
  )
    return null;

  const filled = Math.round(
    (Math.max(0, Math.min(100, percent)) / 100) * (size + 1),
  );
  return (
    (filled > 0 ? startFull : startEmpty) +
    Array.from({ length: size }, (_, index) =>
      index < filled - 1 ? midFull : midEmpty,
    ).join("") +
    (filled > size ? endFull : endEmpty)
  );
}
