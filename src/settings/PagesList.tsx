import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent
} from "@dnd-kit/core";
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	BarChart3,
	CalendarDays,
	GripVertical,
	Headphones,
	LayoutGrid,
	SlidersHorizontal,
	Star,
	Timer
} from "lucide-react";
import { PANEL_DESCRIPTIONS, PANEL_LABELS, type NotchPanel } from "../notchPanels";

const PANEL_ICONS: Record<NotchPanel, typeof Timer> = {
	calendar: CalendarDays,
	timer: Timer,
	stats: BarChart3,
	launcher: LayoutGrid,
	"command-center": SlidersHorizontal,
	devices: Headphones
};

interface PagesListProps {
	order: NotchPanel[];
	onOrderChange: (order: NotchPanel[]) => void;
	enabled: Record<NotchPanel, boolean>;
	onToggle: (panel: NotchPanel) => void;
	/** The page a click opens; null hides the stars (panel memory is on). */
	defaultPanel: NotchPanel | null;
	onDefaultChange: (panel: NotchPanel) => void;
}

function PageRow({
	panel,
	on,
	isLast,
	isDefault,
	showStar,
	onToggle,
	onDefault
}: {
	panel: NotchPanel;
	on: boolean;
	isLast: boolean;
	isDefault: boolean;
	showStar: boolean;
	onToggle: () => void;
	onDefault: () => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: panel });
	const Icon = PANEL_ICONS[panel];
	const label = PANEL_LABELS[panel];
	return (
		<div
			ref={setNodeRef}
			className={`pages-row ${isDragging ? "dragging" : ""} ${on ? "" : "off"}`}
			style={{ transform: CSS.Transform.toString(transform), transition }}
		>
			<button className="pages-grip" aria-label={`Drag to move ${label}`} {...attributes} {...listeners}>
				<GripVertical size={14} strokeWidth={2} />
			</button>
			<span className="pages-icon">
				<Icon size={14} strokeWidth={2} />
			</span>
			<span className="pages-text">
				<span className="pages-name">{label}</span>
				<span className="pages-desc">{PANEL_DESCRIPTIONS[panel]}</span>
			</span>
			{showStar && (
				<button
					className={`pages-star ${isDefault ? "on" : ""}`}
					disabled={!on}
					onClick={onDefault}
					aria-pressed={isDefault}
					aria-label={isDefault ? `${label} opens on click` : `Open ${label} on click`}
					title={isDefault ? "Opens when you click the notch" : "Open this page when you click the notch"}
				>
					<Star size={13} strokeWidth={2.2} fill={isDefault ? "currentColor" : "none"} />
				</button>
			)}
			<label className="toggle-switch" title={isLast ? "The notch needs at least one page" : undefined}>
				<input
					type="checkbox"
					checked={on}
					disabled={isLast}
					onChange={onToggle}
					aria-label={`Show ${label}`}
				/>
				<span className="slider"></span>
			</label>
		</div>
	);
}

/**
 * Settings > Notch > Pages: every notch page in scroll order, each with its
 * own switch. Drag to reorder; the star marks the page a click opens.
 */
export function PagesList({
	order,
	onOrderChange,
	enabled,
	onToggle,
	defaultPanel,
	onDefaultChange
}: PagesListProps) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);
	const onCount = order.filter((p) => enabled[p]).length;
	// A default that's switched off falls back to the first page that's on.
	const effectiveDefault =
		defaultPanel && enabled[defaultPanel] ? defaultPanel : (order.find((p) => enabled[p]) ?? null);
	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const from = order.indexOf(active.id as NotchPanel);
		const to = order.indexOf(over.id as NotchPanel);
		if (from < 0 || to < 0) return;
		onOrderChange(arrayMove(order, from, to));
	};
	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
			<SortableContext items={order} strategy={verticalListSortingStrategy}>
				<div className="pages-list">
					{order.map((panel) => (
						<PageRow
							key={panel}
							panel={panel}
							on={enabled[panel]}
							isLast={enabled[panel] && onCount <= 1}
							isDefault={panel === effectiveDefault}
							showStar={defaultPanel !== null}
							onToggle={() => onToggle(panel)}
							onDefault={() => onDefaultChange(panel)}
						/>
					))}
				</div>
			</SortableContext>
		</DndContext>
	);
}
