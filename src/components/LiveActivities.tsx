import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
	BatteryCharging,
	BatteryLow,
	BellRing,
	CalendarClock,
	Download,
	FileClock,
	Music,
	Timer,
	X
} from "lucide-react";
import { toneColor, toneColorOnLight, type Activity, type ActivityKind } from "../liveActivities";

/** Width of each side of the status rail, beside the notch. */
export const RAIL_SIDE = 230;

interface Handlers {
	onOpen: (a: Activity) => void;
	onDismiss: (a: Activity) => void;
	onSnooze: (a: Activity) => void;
	/** Something moved or appeared: the window region and hover rect need updating. */
	onLayoutChange: () => void;
}

export function ActivityIcon({ kind, size = 12 }: { kind: ActivityKind; size?: number }) {
	const props = { size, strokeWidth: 2.4 };
	switch (kind) {
		case "class":
			return <CalendarClock {...props} />;
		case "deadline":
			return <FileClock {...props} />;
		case "timer":
			return <Timer {...props} />;
		case "timer-done":
			return <BellRing {...props} />;
		case "music":
			return <Music {...props} />;
		case "power":
			return <BatteryCharging {...props} />;
		case "low-battery":
			return <BatteryLow {...props} />;
		default:
			return <Download {...props} />;
	}
}

function toneVar(a: Activity): CSSProperties {
	return { "--la-tone": toneColor(a.tone) } as CSSProperties;
}

/** The thin glowing line along the bottom of the notch (glow style). Its
 * length is the primary activity's progress; a second activity gets its own
 * short segment at the end. */
export function GlowLine({ primary, secondary }: { primary: Activity; secondary?: Activity }) {
	const p = Math.max(0.04, Math.min(1, primary.progress ?? 1));
	return (
		<motion.span
			className="la-glow-track"
			aria-hidden="true"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1, transition: { delay: 0.15, duration: 0.3 } }}
			exit={{ opacity: 0, transition: { duration: 0.15 } }}
		>
			<span className="la-glow-seg" style={{ flex: secondary ? "0 0 62%" : "1 1 auto" }}>
				<span className="la-glow-fill" style={{ ...toneVar(primary), width: `${p * 100}%` }} />
			</span>
			{secondary && (
				<span className="la-glow-seg">
					<span className="la-glow-fill" style={{ ...toneVar(secondary), width: "100%" }} />
				</span>
			)}
		</motion.span>
	);
}

/** What the notch says instead of the clock in glow style. */
export function GlowRow({ primary, secondary }: { primary: Activity; secondary?: Activity }) {
	return (
		<span className="la-glow-row" style={toneVar(primary)}>
			{secondary && <span className="la-glow-dot" style={toneVar(secondary)} title={secondary.title} />}
			<span className="la-glow-title">{primary.title}</span>
			{primary.value && (
				<>
					<span className="la-dim">·</span>
					<b className="la-tone">{primary.value}</b>
				</>
			)}
		</span>
	);
}

function TagLabel({ a, first }: { a: Activity; first: boolean }) {
	return (
		<>
			<span className="la-tag-mark">
				{a.art ? <img src={a.art} alt="" draggable={false} /> : <ActivityIcon kind={a.kind} size={10} />}
			</span>
			<b className="la-tag-title">{a.title}</b>
			{first && a.detail && <span className="la-dim la-tag-detail">{a.detail}</span>}
			{a.value && <b className="la-tone">{a.value}</b>}
		</>
	);
}

/** Labels hanging under the notch on thin strings (tags style). */
function Tags({ activities, pillHeight, onOpen, onDismiss, onLayoutChange }: Props) {
	const tilt = [-1.5, 1.8, -1];
	return (
		<div className="la-tags" style={{ top: pillHeight }}>
			<AnimatePresence onExitComplete={onLayoutChange}>
				{activities.slice(0, 3).map((a, i) => (
					<motion.div
						key={a.id}
						className="la-tag-wrap live-activity"
						style={{ ...toneVar(a), transformOrigin: "top center" }}
						initial={{ opacity: 0, y: -16, rotate: i % 2 ? 10 : -10 }}
						animate={{ opacity: 1, y: 0, rotate: tilt[i] }}
						exit={{ opacity: 0, y: -12, transition: { duration: 0.16 } }}
						transition={{ type: "spring", stiffness: 240, damping: 9, mass: 0.7, opacity: { duration: 0.18 } }}
						onAnimationComplete={onLayoutChange}
					>
						<span className="la-string" style={{ height: 8 + i * 5 }} />
						<div className={`la-tag ${a.alert ? "alert" : ""}`}>
							<button className="la-tag-main" onClick={() => onOpen(a)} title={a.detail ? `${a.title} · ${a.detail}` : a.title}>
								<TagLabel a={a} first={i === 0} />
							</button>
							{a.dismissable && (
								<button className="la-tag-x" onClick={() => onDismiss(a)} aria-label={`Dismiss ${a.title}`}>
									<X size={10} strokeWidth={2.8} />
								</button>
							)}
						</div>
					</motion.div>
				))}
			</AnimatePresence>
		</div>
	);
}

function RailSide({ a, alt, align, onOpen }: { a: Activity; alt?: boolean; align: "left" | "right"; onOpen: (a: Activity) => void }) {
	// The right side shows the second activity, or the first one's details.
	const parts: ReactNode = alt ? (
		<>
			{a.detail && <span className="la-dim">{a.detail}</span>}
			{a.value && <span className="la-tone">{a.value}</span>}
		</>
	) : (
		<>
			<span className="la-tone">{a.label}</span>
			<span className="la-rail-title">{a.kind === "timer" && a.value ? a.value : a.title}</span>
			{align === "right" && a.kind === "timer" && a.progress !== undefined && (
				<span className="la-rail-bar">
					<span style={{ width: `${Math.round(a.progress * 100)}%` }} />
				</span>
			)}
			{align === "right" && a.value && a.kind !== "timer" && <span className="la-tone">{a.value}</span>}
		</>
	);
	return (
		<button className={`la-rail-side ${align}`} style={toneVar(a)} onClick={() => onOpen(a)} title={a.title}>
			{parts}
		</button>
	);
}

/** A thin readout strip sliding out from both sides of the notch (rail style). */
function Rail({ activities, pillWidth, onOpen, onLayoutChange }: Props) {
	const [first, second] = activities;
	const width = pillWidth + RAIL_SIDE * 2;
	return (
		<AnimatePresence onExitComplete={onLayoutChange}>
			{first && (
				<motion.div
					key="rail"
					className={`la-rail live-activity ${first.alert ? "alert" : ""}`}
					style={{ ...toneVar(first), width, marginLeft: -width / 2 }}
					initial={{ clipPath: "inset(0px 50% 0px 50%)", opacity: 0 }}
					animate={{ clipPath: "inset(0px 0% 0px 0%)", opacity: 1 }}
					exit={{ clipPath: "inset(0px 50% 0px 50%)", opacity: 0, transition: { duration: 0.25 } }}
					transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
					onAnimationComplete={onLayoutChange}
				>
					<RailSide a={first} align="left" onOpen={onOpen} />
					<span style={{ width: pillWidth, flexShrink: 0 }} />
					{second ? (
						<RailSide a={second} align="right" onOpen={onOpen} />
					) : (
						<RailSide a={first} alt align="right" onOpen={onOpen} />
					)}
				</motion.div>
			)}
		</AnimatePresence>
	);
}

const CARD_TINT: Partial<Record<ActivityKind, string>> = {
	deadline: "#fdecea",
	"timer-done": "#fdecea",
	"low-battery": "#fdecea",
	power: "#eafaef",
	update: "#eafaef"
};

/** A light card dropping out below the notch; ongoing things as chips (cards style). */
function Cards({ activities, pillHeight, onOpen, onDismiss, onSnooze, onLayoutChange }: Props) {
	const alerts = activities.filter((a) => a.alert);
	const ongoing = activities.filter((a) => !a.alert);
	const card = alerts[0];
	const behind = alerts.length + ongoing.length > 1;
	return (
		<div className="la-cards" style={{ top: pillHeight + 10 }}>
			<AnimatePresence mode="popLayout" onExitComplete={onLayoutChange}>
				{card ? (
					<motion.div
						key={card.id}
						className="la-card-stack live-activity"
						initial={{ opacity: 0, y: -26, scale: 0.94 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -18, scale: 0.96, transition: { duration: 0.18 } }}
						transition={{ type: "spring", stiffness: 380, damping: 28 }}
						onAnimationComplete={onLayoutChange}
					>
						{behind && <div className="la-card-behind" />}
						<div className="la-card" style={{ background: CARD_TINT[card.kind] ?? "#f5f5f7" }}>
							<button className="la-card-main" onClick={() => onOpen(card)}>
								<span className="la-card-icon" style={{ background: toneColor(card.tone) }}>
									<ActivityIcon kind={card.kind} size={15} />
								</span>
								<span className="la-card-text">
									<b>{card.title}</b>
									{card.detail && <span>{card.detail}</span>}
								</span>
								{card.value && (
									<b className="la-card-value" style={{ color: toneColorOnLight(card.tone) }}>
										{card.value}
									</b>
								)}
							</button>
							{(card.snoozable || card.dismissable) && (
								<div className="la-card-actions">
									{card.snoozable && <button onClick={() => onSnooze(card)}>Snooze 5 min</button>}
									<button className="primary" onClick={() => onOpen(card)}>
										Open
									</button>
									{card.dismissable && (
										<button className="icon" onClick={() => onDismiss(card)} aria-label="Dismiss">
											<X size={12} strokeWidth={2.6} />
										</button>
									)}
								</div>
							)}
						</div>
					</motion.div>
				) : ongoing.length > 0 ? (
					<motion.div
						key={`chips-${ongoing.map((a) => a.kind).join("-")}`}
						className="la-chips"
						initial={{ opacity: 0, y: -18 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -12, transition: { duration: 0.16 } }}
						transition={{ type: "spring", stiffness: 380, damping: 28 }}
						onAnimationComplete={onLayoutChange}
					>
						{ongoing.slice(0, 2).map((a) => (
							<button key={a.id} className="la-chip live-activity" onClick={() => onOpen(a)} title={a.title}>
								{a.art ? (
									<img src={a.art} alt="" draggable={false} />
								) : (
									<span className="la-chip-icon" style={{ color: toneColorOnLight(a.tone) }}>
										<ActivityIcon kind={a.kind} size={14} />
									</span>
								)}
								<span className="la-chip-text">
									<b>{a.kind === "timer" ? a.value ?? a.title : a.title}</b>
									{a.kind !== "timer" && a.detail && <span>{a.detail}</span>}
								</span>
							</button>
						))}
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}

interface Props extends Handlers {
	activities: Activity[];
	pillWidth: number;
	pillHeight: number;
}

/** Live activities drawn outside the notch: tags, rail or cards. */
export function LiveActivities(props: Props & { variant: "tags" | "rail" | "cards" }) {
	if (props.variant === "rail") return <Rail {...props} />;
	if (props.variant === "tags") return <Tags {...props} />;
	return <Cards {...props} />;
}
