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
	CalendarDays,
	ChevronDown,
	ChevronUp,
	GripVertical,
	Headphones,
	LayoutGrid,
	SlidersHorizontal,
	Timer
} from "lucide-react";
import { PANEL_LABELS, type NotchPanel } from "../notchPanels";

const PANEL_ICONS: Record<NotchPanel, typeof Timer> = {
	calendar: CalendarDays,
	timer: Timer,
	launcher: LayoutGrid,
	"command-center": SlidersHorizontal,
	devices: Headphones
};

interface PanelOrderListProps {
	order: NotchPanel[];
	onChange: (order: NotchPanel[]) => void;
	/** Pages that are switched off elsewhere (shown dimmed, still movable). */
	disabled: NotchPanel[];
}

function Row({
	panel,
	index,
	count,
	off,
	move
}: {
	panel: NotchPanel;
	index: number;
	count: number;
	off: boolean;
	move: (from: number, to: number) => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: panel });
	const Icon = PANEL_ICONS[panel];
	return (
		<div
			ref={setNodeRef}
			className={`panel-order-row ${isDragging ? "dragging" : ""} ${off ? "off" : ""}`}
			style={{ transform: CSS.Transform.toString(transform), transition }}
		>
			<button className="panel-order-grip" aria-label={`Drag to move ${PANEL_LABELS[panel]}`} {...attributes} {...listeners}>
				<GripVertical size={14} strokeWidth={2} />
			</button>
			<span className="panel-order-index">{index + 1}</span>
			<Icon size={14} strokeWidth={2} className="panel-order-icon" />
			<span className="panel-order-name">
				{PANEL_LABELS[panel]}
				{off && <span className="panel-order-note"> · turned off</span>}
			</span>
			<button
				className="panel-order-step"
				aria-label={`Move ${PANEL_LABELS[panel]} up`}
				disabled={index === 0}
				onClick={() => move(index, index - 1)}
			>
				<ChevronUp size={13} strokeWidth={2.4} />
			</button>
			<button
				className="panel-order-step"
				aria-label={`Move ${PANEL_LABELS[panel]} down`}
				disabled={index === count - 1}
				onClick={() => move(index, index + 1)}
			>
				<ChevronDown size={13} strokeWidth={2.4} />
			</button>
		</div>
	);
}

/** Drag (or use the arrows) to set the order the notch pages scroll in. */
export function PanelOrderList({ order, onChange, disabled }: PanelOrderListProps) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);
	const move = (from: number, to: number) => {
		if (to < 0 || to >= order.length || from === to) return;
		onChange(arrayMove(order, from, to));
	};
	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		move(order.indexOf(active.id as NotchPanel), order.indexOf(over.id as NotchPanel));
	};
	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
			<SortableContext items={order} strategy={verticalListSortingStrategy}>
				<div className="panel-order-list">
					{order.map((panel, i) => (
						<Row
							key={panel}
							panel={panel}
							index={i}
							count={order.length}
							off={disabled.includes(panel)}
							move={move}
						/>
					))}
				</div>
			</SortableContext>
		</DndContext>
	);
}
