import { LANE_COUNT } from '../constants';

export interface InputHandlers {
  /** `timeStamp` is the event's performance.now()-based timestamp in ms. */
  press(lane: number, timeStamp: number): void;
  release(lane: number, timeStamp: number): void;
  pause(): void;
}

/**
 * Turns keyboard, touch and mouse input into lane press/release events.
 * A lane counts as held while any source (key, finger, mouse) holds it.
 */
export class InputManager {
  private keyMap = new Map<string, number>();
  private touchLane = new Map<number, number>();
  private mouseLane: number | null = null;
  private laneSources: number[] = new Array(LANE_COUNT).fill(0);
  private keysDown = new Set<string>();
  enabled = true;

  constructor(
    private surface: HTMLElement,
    keys: readonly string[],
    private laneAtX: (clientX: number) => number,
    private handlers: InputHandlers,
  ) {
    keys.forEach((code, lane) => this.keyMap.set(code, lane));
  }

  isHeld(lane: number): boolean {
    return this.laneSources[lane] > 0;
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
    const opts = { passive: false } as const;
    this.surface.addEventListener('touchstart', this.onTouchStart, opts);
    this.surface.addEventListener('touchend', this.onTouchEnd, opts);
    this.surface.addEventListener('touchcancel', this.onTouchEnd, opts);
    this.surface.addEventListener('touchmove', this.preventDefault, opts);
    this.surface.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.surface.addEventListener('contextmenu', this.preventDefault);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.releaseAll);
    this.surface.removeEventListener('touchstart', this.onTouchStart);
    this.surface.removeEventListener('touchend', this.onTouchEnd);
    this.surface.removeEventListener('touchcancel', this.onTouchEnd);
    this.surface.removeEventListener('touchmove', this.preventDefault);
    this.surface.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.surface.removeEventListener('contextmenu', this.preventDefault);
  }

  private down(lane: number, ts: number): void {
    this.laneSources[lane]++;
    if (this.enabled) this.handlers.press(lane, ts);
  }

  private up(lane: number, ts: number): void {
    this.laneSources[lane] = Math.max(0, this.laneSources[lane] - 1);
    if (this.enabled) this.handlers.release(lane, ts);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (!e.repeat) this.handlers.pause();
      return;
    }
    const lane = this.keyMap.get(e.code);
    if (lane === undefined) return;
    e.preventDefault();
    if (e.repeat || this.keysDown.has(e.code)) return;
    this.keysDown.add(e.code);
    this.down(lane, e.timeStamp);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const lane = this.keyMap.get(e.code);
    if (lane === undefined || !this.keysDown.has(e.code)) return;
    e.preventDefault();
    this.keysDown.delete(e.code);
    this.up(lane, e.timeStamp);
  };

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const lane = this.laneAtX(t.clientX);
      this.touchLane.set(t.identifier, lane);
      this.down(lane, e.timeStamp);
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const lane = this.touchLane.get(t.identifier);
      if (lane === undefined) continue;
      this.touchLane.delete(t.identifier);
      this.up(lane, e.timeStamp);
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0 || this.mouseLane !== null) return;
    e.preventDefault();
    this.mouseLane = this.laneAtX(e.clientX);
    this.down(this.mouseLane, e.timeStamp);
  };

  private onMouseUp = (e: MouseEvent) => {
    if (this.mouseLane === null) return;
    const lane = this.mouseLane;
    this.mouseLane = null;
    this.up(lane, e.timeStamp);
  };

  private preventDefault = (e: Event) => e.preventDefault();

  /** Drop every held source (window blur, pause). */
  releaseAll = () => {
    const now = performance.now();
    this.keysDown.clear();
    this.touchLane.clear();
    this.mouseLane = null;
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      if (this.laneSources[lane] > 0) {
        this.laneSources[lane] = 0;
        if (this.enabled) this.handlers.release(lane, now);
      }
    }
  };
}
