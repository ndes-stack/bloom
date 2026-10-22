// Turns wheel / touchpad scrolling into page flips at a steady pace.
//
// Wheel input arrives as a stream of small events, and a touchpad keeps
// sending them after the fingers lift (momentum). The rules:
//   - the first flip of a scroll happens right away;
//   - while you keep scrolling, it keeps flipping, at most once per
//     `intervalMs` (the Scroll speed setting);
//   - momentum is ignored: once the events die away steadily the
//     fingers are off, so nothing more flips until you scroll again;
//   - reversing direction starts fresh, so going back is instant.

/** Scroll speed setting (1 slowest … 5 fastest) → minimum time between flips. */
export const SCROLL_SPEED_INTERVALS_MS = [900, 650, 450, 320, 220] as const;
export const DEFAULT_SCROLL_SPEED = 3;
export const SCROLL_SPEED_KEY = "bloom-scroll-speed";

export function clampScrollSpeed(value: unknown): number {
	const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
	if (!Number.isFinite(n)) return DEFAULT_SCROLL_SPEED;
	return Math.min(5, Math.max(1, Math.round(n)));
}

export function scrollSpeedIntervalMs(speed: number): number {
	return SCROLL_SPEED_INTERVALS_MS[clampScrollSpeed(speed) - 1];
}

export interface ScrollFlipper {
	/** Feed every wheel event's delta and timestamp; returns +1 / -1 to flip, else 0. */
	push(delta: number, now: number): -1 | 0 | 1;
	/** Forget the last flip (used when a flip was refused, so the next movement retries). */
	release(): void;
	setIntervalMs(ms: number): void;
}

export function createScrollFlipper({
	intervalMs = SCROLL_SPEED_INTERVALS_MS[DEFAULT_SCROLL_SPEED - 1],
	idleMs = 200,
	threshold = 12
}: { intervalMs?: number; idleMs?: number; threshold?: number } = {}): ScrollFlipper {
	let interval = intervalMs;
	let lastEventAt = -Infinity;
	let lastFlipAt = -Infinity;
	let accumulated = 0;
	let direction = 0;
	let prevAbs = 0;
	let peakAbs = 0;
	let shrinkingRun = 0;
	let coasting = false;

	const resetMotion = () => {
		accumulated = 0;
		prevAbs = 0;
		peakAbs = 0;
		shrinkingRun = 0;
		coasting = false;
		lastFlipAt = -Infinity;
	};

	return {
		push(delta, now) {
			const abs = Math.abs(delta);
			if (abs === 0) return 0;
			const dir = Math.sign(delta);

			// A pause, or a change of direction, starts a fresh scroll.
			if (now - lastEventAt > idleMs || (direction !== 0 && dir !== direction)) resetMotion();
			lastEventAt = now;
			direction = dir;

			// Momentum: events that keep shrinking well below the scroll's peak.
			// A clear jump back up means the fingers are moving again.
			if (coasting && abs > prevAbs * 1.5 && abs >= peakAbs * 0.5) {
				coasting = false;
				shrinkingRun = 0;
				peakAbs = abs;
			}
			shrinkingRun = abs < prevAbs * 0.97 ? shrinkingRun + 1 : 0;
			peakAbs = Math.max(peakAbs, abs);
			prevAbs = abs;
			if (!coasting && shrinkingRun >= 4 && abs < peakAbs * 0.6) coasting = true;
			if (coasting) {
				accumulated = 0;
				return 0;
			}

			accumulated += delta;
			if (Math.abs(accumulated) < threshold) return 0;
			if (now - lastFlipAt < interval) return 0;
			lastFlipAt = now;
			accumulated = 0;
			return dir > 0 ? 1 : -1;
		},
		release() {
			lastFlipAt = -Infinity;
		},
		setIntervalMs(ms) {
			interval = ms;
		}
	};
}
