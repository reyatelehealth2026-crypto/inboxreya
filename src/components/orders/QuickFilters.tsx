/**
 * QuickFilters Component
 * Search, date filter, status filter
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { OrderFilters, OrderStatus } from '@/lib/orders/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Calendar,
  Filter,
  X,
  ChevronDown,
  SortAsc,
  SortDesc,
} from 'lucide-react';

interface QuickFiltersProps {
  filters: OrderFilters;
  onFiltersChange: (filters: OrderFilters) => void;
  totalOrders: number;
  className?: string;
}

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'today', label: 'วันนี้' },
  { value: 'week', label: '7 วัน' },
  { value: 'month', label: '30 วัน' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'ทุกสถานะ', color: '#6B7280' },
  { value: 'pending', label: 'รอดำเนินการ', color: '#F59E0B' },
  { value: 'processing', label: 'กำลังจัดส่ง', color: '#F97316' },
  { value: 'shipped', label: 'จัดส่งแล้ว', color: '#3B82F6' },
  { value: 'delivered', label: 'สำเร็จ', color: '#22C55E' },
];

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'ใหม่สุด', icon: <SortDesc className="h-4 w-4" /> },
  { value: 'date_asc', label: 'เก่าสุด', icon: <SortAsc className="h-4 w-4" /> },
  { value: 'amount_desc', label: 'มูลค่าสูง', icon: <SortDesc className="h-4 w-4" /> },
  { value: 'amount_asc', label: 'มูลค่าต่ำ', icon: <SortAsc className="h-4 w-4" /> },
  { value: 'urgent', label: 'ด่วนที่สุด', icon: <SortDesc className="h-4 w-4" /> },
];

export function QuickFilters({
  filters,
  onFiltersChange,
  totalOrders,
  className,
}: QuickFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [isExpanded, setIsExpanded] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFiltersChange({ ...filters, search: searchValue || undefined });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, filters, onFiltersChange]);

  const handleClearFilters = () => {
    setSearchValue('');
    onFiltersChange({});
  };

  const hasActiveFilters =
    filters.search ||
    (filters.status && filters.status !== 'all') ||
    (filters.dateRange && filters.dateRange !== 'all');

  const activeFilterCount = [
    filters.search,
    filters.status && filters.status !== 'all',
    filters.dateRange && filters.dateRange !== 'all',
  ].filter(Boolean).length;

  return (
    <div className={cn('bg-white rounded-lg border shadow-sm', className)}>
      {/* Main Filter Bar */}
      <div className="flex items-center gap-3 p-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="ค้นหาออเดอร์, ชื่อร้าน, เบอร์โทร..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Quick Status Filter */}
        <div className="hidden lg:flex items-center gap-1">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  status: option.value === 'all' ? undefined : (option.value as OrderStatus),
                })
              }
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                filters.status === option.value ||
                  (option.value === 'all' && !filters.status)
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: option.color }}
              />
              {option.label}
            </button>
          ))}
        </div>

        {/* Expand Button (Mobile/Tablet) */}
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Filter className="h-4 w-4 mr-1" />
          กรอง
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {/* More Filters Button */}
        <Button
          variant="outline"
          size="sm"
          className="hidden lg:flex"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <ChevronDown
            className={cn('h-4 w-4 mr-1 transition-transform', isExpanded && 'rotate-180')}
          />
          ตัวเลือกเพิ่มเติม
        </Button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-gray-500"
          >
            <X className="h-4 w-4 mr-1" />
            ล้าง
          </Button>
        )}

        {/* Total Count */}
        <div className="ml-auto text-sm text-gray-500">
          <span className="font-medium text-gray-900">{totalOrders.toLocaleString()}</span>{' '}
          ออเดอร์
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="border-t px-3 py-3 space-y-3">
          {/* Mobile Status Filter */}
          <div className="lg:hidden">
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              สถานะ
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      status: option.value === 'all' ? undefined : (option.value as OrderStatus),
                    })
                  }
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                    filters.status === option.value ||
                      (option.value === 'all' && !filters.status)
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                <Calendar className="h-4 w-4 inline mr-1" />
                ช่วงเวลา
              </label>
              <Select
                value={filters.dateRange || 'all'}
                onValueChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    dateRange: value as OrderFilters['dateRange'],
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                เรียงลำดับ
              </label>
              <Select
                value={filters.sortBy || 'date_desc'}
                onValueChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    sortBy: value as OrderFilters['sortBy'],
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.icon}
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
