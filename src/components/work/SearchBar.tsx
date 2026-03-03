"use client";

import { useState, useCallback, useEffect } from "react";
import { Search, X, Filter, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkStatus, Priority, WorkType } from "@/lib/work/queries";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onFilterChange: (filters: {
    status: WorkStatus[];
    priority: Priority[];
    type: WorkType[];
  }) => void;
  resultCount?: number;
  isLoading?: boolean;
}

const statusOptions: { value: WorkStatus; label: string }[] = [
  { value: "pending", label: "รอดำเนินการ" },
  { value: "in_progress", label: "กำลังทำ" },
  { value: "waiting", label: "รอตอบกลับ" },
  { value: "completed", label: "เสร็จสิ้น" },
];

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "urgent", label: "ด่วน" },
  { value: "high", label: "สูง" },
  { value: "normal", label: "ปกติ" },
  { value: "low", label: "ต่ำ" },
];

const typeOptions: { value: WorkType; label: string }[] = [
  { value: "chat", label: "แชท" },
  { value: "order", label: "ออเดอร์" },
  { value: "inquiry", label: "สอบถาม" },
  { value: "complaint", label: "ร้องเรียน" },
];

export function SearchBar({ 
  onSearch, 
  onFilterChange, 
  resultCount, 
  isLoading 
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<{
    status: WorkStatus[];
    priority: Priority[];
    type: WorkType[];
  }>({
    status: [],
    priority: [],
    type: [],
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const handleFilterToggle = useCallback((
    category: "status" | "priority" | "type",
    value: WorkStatus | Priority | WorkType
  ) => {
    setFilters((prev) => {
      const current = prev[category] as (WorkStatus | Priority | WorkType)[];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      
      const newFilters = { ...prev, [category]: updated } as typeof prev;
      onFilterChange(newFilters);
      return newFilters;
    });
  }, [onFilterChange]);

  const clearFilters = useCallback(() => {
    const emptyFilters = { status: [], priority: [], type: [] };
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  }, [onFilterChange]);

  const clearSearch = useCallback(() => {
    setQuery("");
    onSearch("");
  }, [onSearch]);

  const activeFilterCount = filters.status.length + filters.priority.length + filters.type.length;

  return (
    <div className="space-y-3">
      {/* Main search row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="ค้นหาลูกค้า, ข้อความ, หรือแท็ก..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10 h-11 bg-white border-gray-200 focus-visible:ring-blue-500"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 text-gray-400"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <DropdownMenu open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="h-11 px-4 gap-2 relative"
            >
              <SlidersHorizontal className="h-4 w-4" />
              ตัวกรอง
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>กรองตามสถานะ</DropdownMenuLabel>
            {statusOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={filters.status.includes(option.value)}
                onCheckedChange={() => handleFilterToggle("status", option.value)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuLabel>กรองตามความสำคัญ</DropdownMenuLabel>
            {priorityOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={filters.priority.includes(option.value)}
                onCheckedChange={() => handleFilterToggle("priority", option.value)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuLabel>กรองตามประเภท</DropdownMenuLabel>
            {typeOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={filters.type.includes(option.value)}
                onCheckedChange={() => handleFilterToggle("type", option.value)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
            
            {activeFilterCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-gray-500"
                  onClick={clearFilters}
                >
                  <X className="h-4 w-4 mr-1" />
                  ล้างตัวกรอง
                </Button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Results info & Active filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {resultCount !== undefined && !isLoading && (
            <span className="text-sm text-gray-600">
              พบ <strong className="text-gray-900">{resultCount}</strong> รายการ
            </span>
          )}
          {isLoading && (
            <span className="text-sm text-gray-500">กำลังค้นหา...</span>
          )}
        </div>

        {/* Active filter chips */}
        <div className="flex items-center gap-1 flex-wrap">
          {filters.status.map((status) => {
            const label = statusOptions.find((s) => s.value === status)?.label;
            return (
              <button
                key={status}
                onClick={() => handleFilterToggle("status", status)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                {label}
                <X className="h-3 w-3" />
              </button>
            );
          })}
          {filters.priority.map((priority) => {
            const label = priorityOptions.find((p) => p.value === priority)?.label;
            return (
              <button
                key={priority}
                onClick={() => handleFilterToggle("priority", priority)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100"
              >
                {label}
                <X className="h-3 w-3" />
              </button>
            );
          })}
          {filters.type.map((type) => {
            const label = typeOptions.find((t) => t.value === type)?.label;
            return (
              <button
                key={type}
                onClick={() => handleFilterToggle("type", type)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                {label}
                <X className="h-3 w-3" />
              </button>
            );
          })}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              ล้างทั้งหมด
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
