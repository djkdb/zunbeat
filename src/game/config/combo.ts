/** Combo milestones that trigger escalating presentation. */
export const COMBO_MILESTONES = [25, 50, 100, 200, 300, 400, 500, 750, 1000] as const;

/** Visual tier used by the HUD: 0 = plain, 1 = glow, 2 = strong, 3 = special, 4 = max. */
export function comboTier(combo: number): number {
  if (combo >= 200) return 4;
  if (combo >= 100) return 3;
  if (combo >= 50) return 2;
  if (combo >= 25) return 1;
  return 0;
}

/** Minimum combo before the combo counter is shown. */
export const COMBO_DISPLAY_MIN = 3;
