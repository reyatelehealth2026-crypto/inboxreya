"use client";

import { useCallback, useState } from "react";
import {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { WorkStatus, CustomerWork } from "@/lib/work/queries";

interface UseWorkDragDropProps {
  workItems: CustomerWork[];
  onStatusChange: (workId: string, newStatus: WorkStatus) => void;
  setWorkItems: (items: CustomerWork[]) => void;
  setFilteredItems: (items: CustomerWork[]) => void;
}

interface UseWorkDragDropReturn {
  sensors: ReturnType<typeof useSensors>;
  activeId: string | null;
  activeWork: CustomerWork | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  dropAnimation: DropAnimation;
}

export function useWorkDragDrop({
  workItems,
  onStatusChange,
  setWorkItems,
  setFilteredItems,
}: UseWorkDragDropProps): UseWorkDragDropReturn {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for desktop (mouse) and touch devices
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevents accidental drags on clicks
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Prevents accidental drags on touch
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeWork = activeId
    ? workItems.find((item) => item.id === activeId) || null
    : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;

      if (!over) return;

      const overId = over.id as string;
      const activeId = active.id as string;

      // Check if dragging over a column (status)
      const columnStatuses: WorkStatus[] = ["pending", "in_progress", "waiting", "completed"];
      const isOverColumn = columnStatuses.includes(overId as WorkStatus);

      if (isOverColumn) {
        const newStatus = overId as WorkStatus;
        const activeItem = workItems.find((item) => item.id === activeId);

        if (activeItem && activeItem.status !== newStatus) {
          // Optimistic UI update - move card visually while dragging
          const updatedItems = workItems.map((item) =>
            item.id === activeId ? { ...item, status: newStatus } : item
          );
          setWorkItems(updatedItems);
          setFilteredItems(updatedItems);
        }
      }
    },
    [workItems, setWorkItems, setFilteredItems]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const overId = over.id as string;
      const activeId = active.id as string;

      // Check if dropped on a column
      const columnStatuses: WorkStatus[] = ["pending", "in_progress", "waiting", "completed"];
      const isOverColumn = columnStatuses.includes(overId as WorkStatus);

      if (isOverColumn) {
        const newStatus = overId as WorkStatus;
        const activeItem = workItems.find((item) => item.id === activeId);

        if (activeItem && activeItem.status !== newStatus) {
          // Trigger the actual status change (with optimistic UI)
          onStatusChange(activeId, newStatus);
        }
      }
    },
    [workItems, onStatusChange]
  );

  // Smooth drop animation configuration
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };

  return {
    sensors,
    activeId,
    activeWork,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    dropAnimation,
  };
}
