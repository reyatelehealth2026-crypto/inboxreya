'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const CAMPAIGN_STATUS_TABS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'draft', label: 'ฉบับร่าง' },
  { value: 'scheduled', label: 'ตั้งเวลา' },
  { value: 'sending', label: 'กำลังส่ง' },
  { value: 'sent', label: 'ส่งแล้ว' },
  { value: 'failed', label: 'ล้มเหลว' },
  { value: 'cancelled', label: 'ยกเลิก' },
] as const

interface CampaignFiltersProps {
  status: string // 'all' or single status
  search: string
  onStatusChange: (next: string) => void
  onSearchChange: (next: string) => void
  className?: string
}

export function CampaignFilters({
  status,
  search,
  onStatusChange,
  onSearchChange,
  className,
}: CampaignFiltersProps) {
  // Local debounce so the parent only refetches after a short pause in typing.
  const [searchInput, setSearchInput] = useState(search)

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    if (searchInput === search) return
    const t = setTimeout(() => onSearchChange(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput, search, onSearchChange])

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <Tabs value={status} onValueChange={onStatusChange} className="w-full sm:w-auto">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/50 p-1">
          {CAMPAIGN_STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="ค้นหาชื่อ Campaign"
          className="pl-9 pr-9"
        />
        {searchInput ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => {
              setSearchInput('')
              onSearchChange('')
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
