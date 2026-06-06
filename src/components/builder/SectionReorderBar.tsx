import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, User, Briefcase, GraduationCap, Wrench, FolderGit2, Award, Trophy, Languages, FileText } from "lucide-react";
import type { SectionId } from "./types";

const LABELS: Record<SectionId, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  awards: "Awards",
  languages: "Languages",
};

const ICONS: Record<SectionId, React.ComponentType<{ className?: string }>> = {
  summary: FileText,
  experience: Briefcase,
  education: GraduationCap,
  skills: Wrench,
  projects: FolderGit2,
  certifications: Award,
  awards: Trophy,
  languages: Languages,
};

function Chip({ id }: { id: SectionId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const Icon = ICONS[id] ?? User;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-border bg-card text-xs font-medium cursor-grab active:cursor-grabbing hover:border-[var(--navy-light)] hover:bg-muted/50 select-none"
      title={`Drag to reorder ${LABELS[id]}`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{LABELS[id]}</span>
    </div>
  );
}

export function SectionReorderBar({
  order,
  onChange,
}: {
  order: SectionId[];
  onChange: (next: SectionId[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const a = order.indexOf(active.id as SectionId);
    const b = order.indexOf(over.id as SectionId);
    if (a < 0 || b < 0) return;
    onChange(arrayMove(order, a, b));
  };
  if (!order.length) return null;
  return (
    <div className="no-print mb-2 rounded-lg border border-border bg-card/60 backdrop-blur px-2.5 py-2 flex items-center gap-2 overflow-x-auto">
      <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase shrink-0">
        Reorder
      </span>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
        <SortableContext items={order} strategy={horizontalListSortingStrategy}>
          <div className="flex items-center gap-1.5">
            {order.map((id) => (
              <Chip key={id} id={id} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
