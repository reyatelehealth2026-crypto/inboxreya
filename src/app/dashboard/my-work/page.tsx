"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { 
  Briefcase, 
  RefreshCw, 
  LayoutGrid, 
  List,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { WorkSummary } from "@/components/work/WorkSummary";
import { CustomerWorkCard } from "@/components/work/CustomerWorkCard";
import { SortableWorkCard } from "@/components/work/SortableWorkCard";
import { SearchBar } from "@/components/work/SearchBar";
import { NotificationCenter } from "@/components/work/NotificationCenter";
import { useToast } from "@/hooks/use-toast";
import { useWorkRealtime } from "@/hooks/useWorkRealtime";
import {
  getAllWork,
  getWorkSummary,
  searchWork,
  updateWorkStatus,
  CustomerWork,
  WorkSummaryData,
  WorkStatus,
  Priority,
  WorkType,
} from "@/lib/work/queries";
import { cn } from "@/lib/utils";

// Kanban column configuration for Desktop
const kanbanColumns: { 
  id: WorkStatus; 
  title: string; 
  color: string; 
  bgColor: string;
}[] = [
  { 
    id: "pending", 
    title: "รอดำเนินการ", 
    color: "text-amber-700", 
    bgColor: "bg-amber-50/50" 
  },
  { 
    id: "in_progress", 
    title: "กำลังทำ", 
    color: "text-blue-700", 
    bgColor: "bg-blue-50/50" 
  },
  { 
    id: "waiting", 
    title: "รอตอบกลับ", 
    color: "text-purple-700", 
    bgColor: "bg-purple-50/50" 
  },
  { 
    id: "completed", 
    title: "เสร็จสิ้น", 
    color: "text-emerald-700", 
    bgColor: "bg-emerald-50/50" 
  },
];

// Droppable Kanban Column Component
interface DroppableColumnProps {
  column: typeof kanbanColumns[0];
  children: React.ReactNode;
  isOver?: boolean;
}

function DroppableColumn({ column, children, isOver }: DroppableColumnProps) {
  const { setNodeRef, isOver: isOverColumn } = useDroppable({
    id: column.id,
    data: {
      type: "Column",
      status: column.id,
    },
  });

  const isHighlighted = isOver || isOverColumn;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-[320px] lg:w-[360px] flex-shrink-0 rounded-xl border-2 transition-all duration-200",
        column.bgColor,
        isHighlighted
          ? "border-blue-400 ring-2 ring-blue-200 bg-blue-50/80"
          : "border-gray-200"
      )}
    >
      {children}
    </div>
  );
}

export default function MyWorkPage() {
  const [workItems, setWorkItems] = useState<CustomerWork[]>([]);
  const [filteredItems, setFilteredItems] = useState<CustomerWork[]>([]);
  const [summary, setSummary] = useState<WorkSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, WorkStatus>>(new Map());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const { toast } = useToast();
  const toastShownRef = useRef<Set<string>>(new Set());

  // Handle new work notification with toast
  const handleNewWork = useCallback((newWork: CustomerWork) => {
    // Add new work to the list
    setWorkItems(prev => [newWork, ...prev]);
    setFilteredItems(prev => [newWork, ...prev]);

    // Update summary
    setSummary(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        totalPending: prev.totalPending + 1,
        urgentCount: newWork.priority === "urgent" 
          ? prev.urgentCount + 1 
          : prev.urgentCount,
      };
    });

    // Show toast notification
    toast({
      title: "🆕 งานใหม่เข้ามา!",
      description: (
        <div className="space-y-1">
          <p className="font-medium">{newWork.customerName}</p>
          {newWork.orderAmount && (
            <p className="text-emerald-600 font-semibold">
              ฿{newWork.orderAmount.toLocaleString()}
            </p>
          )}
          <p className="text-xs text-gray-500 line-clamp-2">{newWork.lastMessage}</p>
        </div>
      ),
      variant: "default",
      duration: 5000,
    });
  }, [toast]);

  // Initialize realtime notifications
  const {
    notifications,
    unreadCount,
    isSimulating,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    toggleSimulation,
    triggerTestNotification,
  } = useWorkRealtime({
    enabled: true,
    minInterval: 60000, // 1 minute
    maxInterval: 120000, // 2 minutes
    enableSound: true,
    onNewWork: handleNewWork,
  });

  // Configure DnD sensors for desktop and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevents accidental drags on clicks
      },
    })
  );

  // Get active work item for drag overlay
  const activeWorkItem = activeDragId
    ? filteredItems.find((item) => item.id === activeDragId)
    : null;

  // Initial data load
  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [workData, summaryData] = await Promise.all([
        getAllWork(),
        getWorkSummary(),
      ]);
      setWorkItems(workData);
      setFilteredItems(workData);
      setSummary(summaryData);
    } catch (error) {
      console.error("Failed to load work data:", error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle search
  const handleSearch = useCallback(async (
    query: string,
    filters?: { status: WorkStatus[]; priority: Priority[]; type: WorkType[] }
  ) => {
    if (!query.trim() && (!filters || Object.values(filters).every((arr) => arr.length === 0))) {
      setFilteredItems(workItems);
      return;
    }

    try {
      const results = await searchWork(query, filters);
      setFilteredItems(results);
    } catch (error) {
      console.error("Search failed:", error);
    }
  }, [workItems]);

  // Handle filter change
  const handleFilterChange = useCallback((filters: {
    status: WorkStatus[];
    priority: Priority[];
    type: WorkType[];
  }) => {
    handleSearch("", filters);
  }, [handleSearch]);

  // Optimistic status update
  const handleStatusChange = useCallback(async (workId: string, newStatus: WorkStatus) => {
    // Optimistic update
    setOptimisticUpdates((prev) => new Map(prev.set(workId, newStatus)));
    
    setWorkItems((prev) =>
      prev.map((item) =>
        item.id === workId ? { ...item, status: newStatus } : item
      )
    );
    setFilteredItems((prev) =>
      prev.map((item) =>
        item.id === workId ? { ...item, status: newStatus } : item
      )
    );

    try {
      await updateWorkStatus(workId, newStatus);
      // Refresh summary after status change
      const newSummary = await getWorkSummary();
      setSummary(newSummary);
    } catch (error) {
      // Revert on error
      console.error("Failed to update status:", error);
      loadData(false);
    } finally {
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.delete(workId);
        return next;
      });
    }
  }, [loadData]);

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData(false);
    setIsRefreshing(false);
  }, [loadData]);

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const overId = over.id as string;
    const activeId = active.id as string;
    const columnStatuses: WorkStatus[] = ["pending", "in_progress", "waiting", "completed"];

    if (columnStatuses.includes(overId as WorkStatus)) {
      const newStatus = overId as WorkStatus;
      const activeItem = filteredItems.find((item) => item.id === activeId);

      if (activeItem && activeItem.status !== newStatus) {
        handleStatusChange(activeId, newStatus);
      }
    }
  }, [filteredItems, handleStatusChange]);

  // Group items by status for Kanban view
  const getItemsByStatus = (status: WorkStatus) => {
    return filteredItems.filter((item) => item.status === status);
  };

  // Handle card click
  const handleCardClick = useCallback((work: CustomerWork) => {
    // TODO: Open detail modal or navigate to detail page
    console.log("Open work detail:", work.id);
  }, []);

  // Handle notification click
  const handleNotificationClick = useCallback((work: CustomerWork) => {
    // Scroll to the work item or highlight it
    handleCardClick(work);
  }, [handleCardClick]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">งานของฉัน</h1>
                <p className="text-sm text-gray-500">จัดการงานและออเดอร์ประจำวัน</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("kanban")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === "kanban"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Kanban
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === "list"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <List className="h-4 w-4" />
                  รายการ
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                รีเฟรช
              </Button>

              {/* Notification Center */}
              <NotificationCenter
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onClearAll={clearNotifications}
                onNotificationClick={handleNotificationClick}
                isSimulating={isSimulating}
                onToggleSimulation={toggleSimulation}
                onTestNotification={triggerTestNotification}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Cards */}
        <section className="mb-6">
          {summary ? (
            <WorkSummary data={summary} isLoading={isLoading} />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-gray-200 animate-pulse" />
              ))}
            </div>
          )}
        </section>

        <Separator className="my-6" />

        {/* Search & Filter */}
        <section className="mb-6">
          <SearchBar
            onSearch={(query) => handleSearch(query)}
            onFilterChange={handleFilterChange}
            resultCount={filteredItems.length}
            isLoading={isLoading}
          />
        </section>

        {/* Kanban View */}
        {viewMode === "kanban" ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <section className="overflow-x-auto pb-4">
              <div className="flex gap-6 min-w-max">
                {kanbanColumns.map((column) => {
                  const items = getItemsByStatus(column.id);
                  const isUpdating = Array.from(optimisticUpdates.entries()).some(
                    ([id, status]) => status === column.id && items.some((i) => i.id === id)
                  );

                  return (
                    <DroppableColumn key={column.id} column={column}>
                      {/* Column Header */}
                      <div className="flex items-center justify-between p-4 border-b border-gray-200/60">
                        <div className="flex items-center gap-2">
                          <h3 className={`font-semibold ${column.color}`}>{column.title}</h3>
                          <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium bg-white rounded-full text-gray-600 border border-gray-200">
                            {items.length}
                          </span>
                        </div>
                        {isUpdating && (
                          <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
                        )}
                      </div>

                      {/* Column Content */}
                      <ScrollArea className="h-[calc(100vh-380px)]">
                        <div className="p-3 space-y-3">
                          {isLoading ? (
                            // Skeleton loading
                            Array.from({ length: 3 }).map((_, i) => (
                              <div key={i} className="h-32 rounded-lg bg-gray-200 animate-pulse" />
                            ))
                          ) : items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                                <Briefcase className="h-6 w-6 text-gray-400" />
                              </div>
                              <p className="text-sm text-gray-500">ไม่มีงานในรายการนี้</p>
                              <p className="text-xs text-gray-400 mt-1">ลากงานมาวางที่นี่</p>
                            </div>
                          ) : (
                            <SortableContext
                              items={items.map((item) => item.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {items.map((work) => (
                                <SortableWorkCard
                                  key={work.id}
                                  work={work}
                                  onStatusChange={handleStatusChange}
                                  onClick={handleCardClick}
                                />
                              ))}
                            </SortableContext>
                          )}
                        </div>
                      </ScrollArea>
                    </DroppableColumn>
                  );
                })}
              </div>
            </section>
            {/* Drag Overlay for smooth visual feedback */}
            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
              {activeWorkItem ? (
                <CustomerWorkCard
                  work={activeWorkItem}
                  isDragging
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          /* List View */
          <section className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">รายการทั้งหมด</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 h-20 bg-gray-50 animate-pulse" />
                ))
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Briefcase className="h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-gray-500">ไม่พบรายการที่ค้นหา</p>
                  <p className="text-sm text-gray-400 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองดู</p>
                </div>
              ) : (
                filteredItems.map((work) => (
                  <div key={work.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <CustomerWorkCard
                      work={work}
                      onStatusChange={handleStatusChange}
                      onClick={handleCardClick}
                    />
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
