// Turns a burst of wheel events into a single "step".
//
// One swipe on a touchpad (or one quick flick of a mouse wheel) arrives as
// dozens of small wheel events, and touchpads keep sending them for a while
// after the fingers lift (inertia). A fixed cooldown after each step lets a
// long swipe through two or three times. Instead, a gesture fires at most one
// step and only ends once the wheel has been quiet for `idleMs`; every event
// in between, however long the inertia lasts, extends the same gesture.

export interface WheelGestureOptions {
	/** Quiet time that ends a gesture. */
	idleMs?: number;
	/** Scroll distance needed before a gesture counts, to ignore tiny jitters. */
	threshold?: number;
}

export interface WheelGesture {
	/**
	 * Feed every wheel event's delta with its timestamp. Returns +1 or -1 when
	 * this event should trigger a step, otherwise 0.
	 */
	push(delta: number, now: number): -1 | 0 | 1;
	/** Ends the current gesture at once (e.g. after the step was refused). */
	release(): void;
}

export function createWheelGesture({ idleMs = 180, threshold = 12 }: WheelGestureOptions = {}): WheelGesture {
	let lastEventAt = -Infinity;
	let fired = false;
	let accumulated = 0;

	return {
		push(delta, now) {
			if (now - lastEventAt > idleMs) {
				// Quiet long enough: this event starts a new gesture.
				fired = false;
				accumulated = 0;
			}
			lastEventAt = now;
			if (fired) return 0;

			// Changing direction mid-gesture starts the count again.
			if (accumulated !== 0 && Math.sign(delta) !== Math.sign(accumulated)) accumulated = 0;
			accumulated += delta;
			if (Math.abs(accumulated) < threshold) return 0;

			fired = true;
			return accumulated > 0 ? 1 : -1;
		},
		release() {
			fired = false;
			accumulated = 0;
		}
	};
}
