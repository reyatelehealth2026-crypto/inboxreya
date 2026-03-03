"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CustomerWork, WorkStatus } from "@/lib/work/queries";
import { CustomerWorkCard } from "./CustomerWorkCard";
import { cn } from "@/lib/utils";

interface SortableWorkCardProps {
  work: CustomerWork;
  onStatusChange?: (workId: string, newStatus: WorkStatus) => void;
  onClick?: (work: CustomerWork) => void;
}

export function SortableWorkCard({
  work,
  onStatusChange,
  onClick,
}: SortableWorkCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: work.id,
    data: {
      type: "WorkCard",
      work,
      status: work.status,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none", // Prevent text selection while dragging on touch devices
        isDragging && "cursor-grabbing",
        !isDragging && "cursor-grab hover:cursor-grab"
      )}
    >
      <CustomerWorkCard
        work={work}
        onStatusChange={onStatusChange}
        onClick={onClick}
        isDragging={isDragging}
      />
    </div>
  );
}
