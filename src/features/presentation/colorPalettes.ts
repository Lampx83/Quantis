import type { ColorPaletteName } from "@/types";

export const PALETTES: Record<ColorPaletteName, string[]> = {
  academic: [
    "#0061bb", // Navy
    "#c0392b", // Crimson
    "#2e7d32", // Forest green
    "#f59e0b", // Amber
    "#7c3aed", // Purple
    "#0891b2", // Cyan
    "#475569", // Slate
    "#d97706", // Dark amber
  ],
  colorblind: [
    "#0072b2", // Okabe-Ito Blue
    "#e69f00", // Orange
    "#009e73", // Bluish green
    "#d55e00", // Vermilion
    "#cc79a7", // Reddish purple
    "#56b4e9", // Sky blue
    "#f0e442", // Yellow
    "#333333", // Dark slate
  ],
  grayscale: [
    "#222222",
    "#555555",
    "#888888",
    "#aaaaaa",
    "#cccccc",
    "#333333",
    "#666666",
    "#999999",
  ],
};

/**
 * Returns a color from the specified palette at the given index (cycling modulo length).
 */
export function getPaletteColor(
  paletteName: ColorPaletteName = "academic",
  index: number
): string {
  const palette = PALETTES[paletteName] ?? PALETTES.academic;
  return palette[Math.abs(index) % palette.length];
}
