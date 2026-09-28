import { LANE_COUNT } from '../constants';

/**
 * Perspective highway geometry. Depth `z` runs from 0 (judge line) to 1 (far end);
 * negative z extends the highway below the judge line.
 */
export interface Layout {
  width: number;
  height: number;
  dpr: number;
  mobile: boolean;
  centerX: number;
  judgeY: number;
  topY: number;
  vanishY: number;
  /** Highway width at the judge line. */
  baseWidth: number;
  laneWidth: number;
  /** Width ratio far/near. */
  topRatio: number;
  focal: number;
  noteHeight: number;
}

/** Height (px) of the top HUD block on phones; the highway starts below it. */
export const MOBILE_HUD_HEIGHT = 150;

export function computeLayout(width: number, height: number, dpr: number): Layout {
  const portrait = height / width > 1.15;
  const mobile = width < 700 || portrait;
  let baseWidth: number;
  let judgeY: number;
  let topY: number;
  let topRatio: number;
  if (mobile) {
    baseWidth = Math.min(width * 0.98, height * 0.62, 560);
    judgeY = height * 0.8;
    // Start the highway below the HUD block (score + FEVER) so nothing covers incoming notes.
    topY = Math.max(height * 0.12, MOBILE_HUD_HEIGHT);
    topRatio = 0.5;
  } else {
    baseWidth = Math.min(width * 0.46, height * 0.78, 600);
    judgeY = height * 0.83;
    topY = height * 0.04;
    topRatio = 0.4;
  }
  const vanishY = (topY - topRatio * judgeY) / (1 - topRatio);
  const laneWidth = baseWidth / LANE_COUNT;
  return {
    width,
    height,
    dpr,
    mobile,
    centerX: width / 2,
    judgeY,
    topY,
    vanishY,
    baseWidth,
    laneWidth,
    topRatio,
    focal: topRatio / (1 - topRatio),
    noteHeight: Math.max(16, laneWidth * 0.24),
  };
}

/** Perspective scale at depth z (1 at the judge line). */
export function scaleAt(l: Layout, z: number): number {
  return l.focal / (l.focal + z);
}

export function yAt(l: Layout, z: number): number {
  return l.vanishY + (l.judgeY - l.vanishY) * scaleAt(l, z);
}

/** Depth at which the highway reaches screen y (inverse of yAt). */
export function zAtY(l: Layout, y: number): number {
  const s = (y - l.vanishY) / (l.judgeY - l.vanishY);
  return l.focal / s - l.focal;
}

/** X of a lane edge fraction `u` (0 = left edge of highway, LANE_COUNT = right edge) at scale s. */
export function xAt(l: Layout, u: number, s: number): number {
  return l.centerX + (u - LANE_COUNT / 2) * l.laneWidth * s;
}

/** Lane under a screen x coordinate; outer lanes extend to the screen edges. */
export function laneAtX(l: Layout, x: number): number {
  const u = (x - l.centerX) / l.laneWidth + LANE_COUNT / 2;
  return Math.max(0, Math.min(LANE_COUNT - 1, Math.floor(u)));
}
