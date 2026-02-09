/**
 * Group Conversation List Component
 * Displays LINE groups in conversation list format (like inbox)
 */

'use client';

import { useState, useEffect } from 'react';
import { useGroups } from '@/hooks/use-groups';
import { GroupFilters } from '@/types/group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Search, Filter, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface GroupConversationListProps {
  selectedGroupId?: number | null;
  onSelectGroup?: (groupId: number) => void;
}

export function GroupConversationList({
  selectedGroupId,
  onSelectGroup,
}: GroupConversationListProps) {
  const [filters, setFilters] = useState<GroupFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const { groups, stats, loading, error, refetch } = useGroups(filters);

  // Debug logging
  console.log('GroupConversationList - groups:', groups);
  console.log('GroupConversationList - stats:', stats);
  console.log('GroupConversationList - loading:', loading);
  console.log('GroupConversationList - error:', error);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setFilters((prev) => ({ ...prev, search: value }));
  };

  const handleFilterChange = (key: keyof GroupFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleGroupClick = (groupId: number) => {
    onSelectGroup?.(groupId);
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">กลุ่ม LINE</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && 'bg-accent')}
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={refetch}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหากลุ่ม..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-2 pt-2 border-t">
            <Select
              value={filters.isActive === undefined ? 'all' : filters.isActive.toString()}
              onValueChange={(value) =>
                handleFilterChange('isActive', value === 'all' ? undefined : value === 'true')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="true">ใช้งาน</SelectItem>
                <SelectItem value="false">ออกแล้ว</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.groupType || 'all'}
              onValueChange={(value) =>
                handleFilterChange('groupType', value === 'all' ? undefined : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="ประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="group">Group</SelectItem>
                <SelectItem value="room">Room</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="font-semibold text-blue-600">{stats.total}</div>
              <div className="text-muted-foreground">ทั้งหมด</div>
            </div>
            <div>
              <div className="font-semibold text-green-600">{stats.active}</div>
              <div className="text-muted-foreground">ใช้งาน</div>
            </div>
            <div>
              <div className="font-semibold text-purple-600">{stats.totalMembers}</div>
              <div className="text-muted-foreground">สมาชิก</div>
            </div>
          </div>
        )}
      </div>

      {/* Groups List */}
      <ScrollArea className="flex-1">
        {loading && groups.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-destructive">
            <p className="text-sm">{error}</p>
            <Button onClick={refetch} variant="outline" size="sm" className="mt-2">
              ลองอีกครั้ง
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">ไม่พบกลุ่ม</p>
            {searchTerm && (
              <p className="text-xs mt-1">ลองค้นหาด้วยคำอื่น</p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => handleGroupClick(group.id)}
                className={cn(
                  'w-full p-4 hover:bg-accent transition-colors text-left',
                  selectedGroupId === group.id && 'bg-accent'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Group Avatar */}
                  <div className="relative flex-shrink-0">
                    {group.pictureUrl ? (
                      <img
                        src={group.pictureUrl}
                        alt={group.groupName || 'Group'}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    {!group.isActive && (
                      <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                        <span className="text-xs text-white font-medium">ออก</span>
                      </div>
                    )}
                  </div>

                  {/* Group Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-medium truncate">
                        {group.groupName || 'Unknown Group'}
                      </h3>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(group.joinedAt), {
                          addSuffix: true,
                          locale: th,
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={group.isActive ? 'default' : 'secondary'} className="text-xs">
                        {group.isActive ? 'Active' : 'Left'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {group.groupType}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {group.memberCount}
                      </span>
                      <span>
                        {group.totalMessages} ข้อความ
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
